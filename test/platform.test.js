const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createPlatform, sanitizeFilename } = require('../server');

test('creates sessions, protects invites, exposes admin and metrics', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomlens-http-'));
  const platform = createPlatform({
    dataDir,
    adminKey: 'test-admin',
    agentUsername: 'test-agent',
    agentPassword: 'secret-pass',
    reconnectGraceMs: 25
  });
  await platform.listen(0, '127.0.0.1');
  t.after(() => platform.close());

  const base = `http://127.0.0.1:${platform.server.address().port}`;
  const accessInfo = await jsonFetch(`${base}/api/access-info`);
  assert.equal(accessInfo.agentUsername, 'test-agent');
  assert.equal(accessInfo.agentPassword, 'secret-pass');

  const blockedCreate = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentName: 'Ada Agent' })
  });
  assert.equal(blockedCreate.status, 401);

  const login = await jsonFetch(`${base}/api/agent-login`, {
    method: 'POST',
    body: {
      username: 'test-agent',
      password: 'secret-pass'
    }
  });

  const created = await jsonFetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${login.authToken}` },
    body: { agentName: 'Ada Agent' }
  });

  assert.equal(created.status, 'waiting');
  assert.equal(created.participants.agent.name, 'Ada Agent');
  assert.match(created.inviteUrl, /invite=/);
  assert.match(created.agentUrl, /role=agent/);

  const invite = await jsonFetch(`${base}/api/invites/${created.inviteToken}`);
  assert.equal(invite.sessionId, created.id);

  const denied = await fetch(`${base}/api/sessions/${created.id}`);
  assert.equal(denied.status, 404);

  const readable = await jsonFetch(`${base}/api/sessions/${created.id}?token=${created.agentToken}`);
  assert.equal(readable.id, created.id);
  assert.equal(readable.events[0].type, 'session_created');

  const admin = await jsonFetch(`${base}/api/admin/sessions`, {
    headers: { 'x-admin-key': 'test-admin' }
  });
  assert.equal(admin.metrics.totalSessions, 1);

  const demoPack = await jsonFetch(`${base}/api/demo-pack`, {
    method: 'POST',
    headers: { authorization: `Bearer ${login.authToken}` },
    body: {
      agentName: 'Judge Agent',
      customerName: 'Judge Customer'
    }
  });
  assert.equal(demoPack.agentName, 'Judge Agent');
  assert.equal(demoPack.customerName, 'Judge Customer');
  assert.match(demoPack.adminDashboardUrl, /\?admin=1$/);
  assert.equal(demoPack.adminKey, 'test-admin');

  const metrics = await fetch(`${base}/metrics`).then((response) => response.text());
  assert.match(metrics, /atomlens_total_sessions 2/);
});

test('WebSocket participants can join, chat, record, and end a session', async (t) => {
  if (typeof WebSocket !== 'function') {
    t.skip('This Node runtime does not expose a WebSocket client.');
    return;
  }

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomlens-ws-'));
  const platform = createPlatform({
    dataDir,
    adminKey: 'test-admin',
    agentUsername: 'test-agent',
    agentPassword: 'secret-pass',
    reconnectGraceMs: 25
  });
  await platform.listen(0, '127.0.0.1');
  t.after(() => platform.close());

  const base = `http://127.0.0.1:${platform.server.address().port}`;
  const wsBase = base.replace('http:', 'ws:');
  const login = await jsonFetch(`${base}/api/agent-login`, {
    method: 'POST',
    body: {
      username: 'test-agent',
      password: 'secret-pass'
    }
  });
  const created = await jsonFetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${login.authToken}` },
    body: { agentName: 'Video Agent' }
  });

  const agent = await openWs(`${wsBase}/ws`);
  const customer = await openWs(`${wsBase}/ws`);

  agent.send({
    type: 'join',
    sessionId: created.id,
    role: 'agent',
    token: created.agentToken,
    clientId: 'agent-client',
    name: 'Video Agent'
  });
  customer.send({
    type: 'join',
    sessionId: created.id,
    role: 'customer',
    token: created.inviteToken,
    clientId: 'customer-client',
    name: 'Casey Customer'
  });

  assert.equal((await agent.next('joined')).session.status, 'waiting');
  assert.equal((await customer.next('joined')).session.participants.customer.name, 'Casey Customer');
  await agent.next('presence:update');

  agent.send({ type: 'chat:send', text: 'Can you show me the device light?' });
  const chat = await customer.next('chat:message');
  assert.equal(chat.message.text, 'Can you show me the device light?');

  agent.send({
    type: 'file:upload',
    name: 'notes.txt',
    mimeType: 'text/plain',
    data: Buffer.from('hello support').toString('base64')
  });
  const fileMessage = await customer.next('chat:message');
  assert.equal(fileMessage.message.type, 'file');
  assert.match(fileMessage.message.file.url, /token=/);
  const sharedFile = await fetch(`${base}${fileMessage.message.file.url}`);
  assert.equal(sharedFile.status, 200);
  assert.equal(await sharedFile.text(), 'hello support');

  agent.send({ type: 'recording:start' });
  assert.equal((await agent.next('recording:update')).recording.status, 'in_progress');
  agent.send({
    type: 'media:chunk',
    seq: 1,
    mimeType: 'video/webm',
    data: Buffer.from('fake-webm-data').toString('base64')
  });
  await customer.next('media:chunk');
  agent.send({ type: 'recording:stop' });
  assert.equal((await agent.next('recording:update')).recording.status, 'ready');

  const afterRecord = await jsonFetch(`${base}/api/sessions/${created.id}?token=${created.agentToken}`);
  assert.equal(afterRecord.recording.status, 'ready');
  const download = await fetch(`${base}/api/recordings/${created.id}/${afterRecord.recording.id}/download?token=${created.agentToken}`);
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/x-tar');

  customer.send({ type: 'session:end' });
  const customerLeft = await customer.next('session:left');
  assert.equal(customerLeft.session.participants.customer.connected, false);
  const afterCustomerLeft = await jsonFetch(`${base}/api/sessions/${created.id}?token=${created.agentToken}`);
  assert.equal(afterCustomerLeft.status, 'waiting');
  assert.equal(afterCustomerLeft.participants.agent.connected, true);
  assert.equal(afterCustomerLeft.participants.customer.connected, false);

  agent.send({ type: 'session:end' });
  assert.equal((await agent.next('session:ended')).session.status, 'ended');

  agent.close();
  customer.close();
});

test('file names are sanitized for storage', () => {
  assert.equal(sanitizeFilename('../unsafe:name?.pdf'), '..-unsafe-name-.pdf');
});

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || body.error || `Request failed: ${response.status}`);
  }
  return body;
}

function openWs(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const queue = [];
    const waiters = [];
    const timeout = setTimeout(() => reject(new Error('WebSocket open timed out')), 1000);

    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      resolve({
        send(payload) {
          socket.send(JSON.stringify(payload));
        },
        next(type) {
          const index = queue.findIndex((message) => message.type === type);
          if (index >= 0) {
            const [message] = queue.splice(index, 1);
            return Promise.resolve(message);
          }
          return new Promise((nextResolve, nextReject) => {
            const waiter = { type, resolve: nextResolve };
            waiters.push(waiter);
            setTimeout(() => {
              const waiterIndex = waiters.indexOf(waiter);
              if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
              nextReject(new Error(`Timed out waiting for ${type}`));
            }, 1500);
          });
        },
        close() {
          socket.close();
        }
      });
    });
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);
      if (waiterIndex >= 0) {
        const [waiter] = waiters.splice(waiterIndex, 1);
        waiter.resolve(message);
      } else {
        queue.push(message);
      }
    });
    socket.addEventListener('error', reject);
  });
}
