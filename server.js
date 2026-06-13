const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const DEFAULT_HOST = process.env.HOST || '0.0.0.0';
const DEFAULT_ADMIN_KEY = process.env.ADMIN_KEY || 'demo-admin-key';
const DEFAULT_AGENT_USERNAME = process.env.AGENT_USERNAME || 'agent';
const DEFAULT_AGENT_PASSWORD = process.env.AGENT_PASSWORD || 'atomlens123';
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS || 30000);
const MAX_JSON_BODY = 1024 * 1024;
const MAX_WS_MESSAGE = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const DEFAULT_DEMO_AGENT_NAME = 'Judge Agent';
const DEFAULT_DEMO_CUSTOMER_NAME = 'Judge Customer';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function createPlatform(options = {}) {
  const dataDir = options.dataDir || path.join(ROOT_DIR, 'data');
  const uploadsDir = path.join(dataDir, 'uploads');
  const recordingsDir = path.join(dataDir, 'recordings');
  const storePath = path.join(dataDir, 'store.json');
  const adminKey = options.adminKey || DEFAULT_ADMIN_KEY;
  const agentUsername = options.agentUsername || DEFAULT_AGENT_USERNAME;
  const agentPassword = options.agentPassword || DEFAULT_AGENT_PASSWORD;
  const reconnectGraceMs = options.reconnectGraceMs || RECONNECT_GRACE_MS;
  const clients = new Map();
  const graceTimers = new Map();
  const agentAuthTokens = new Map();
  let store = loadStore(storePath);

  ensureDir(dataDir);
  ensureDir(uploadsDir);
  ensureDir(recordingsDir);

  const server = http.createServer(async (req, res) => {
    try {
      await routeHttp(req, res);
    } catch (error) {
      store.counters.errors += 1;
      saveStore();
      sendJson(res, 500, { error: 'internal_error', message: 'Unexpected server error.' });
      console.error(error);
    }
  });

  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto
      .createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    registerClient(socket);
  });

  function loadStore(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          sessions: parsed.sessions || {},
          counters: {
            errors: parsed.counters?.errors || 0
          }
        };
      }
    } catch (error) {
      console.warn('Store could not be read, starting with an empty store.', error.message);
    }
    return { sessions: {}, counters: { errors: 0 } };
  }

  function saveStore() {
    ensureDir(dataDir);
    const tempPath = `${storePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
    fs.renameSync(tempPath, storePath);
  }

  async function routeHttp(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true, service: 'AtomLens Relay' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/access-info') {
      sendJson(res, 200, {
        agentUsername,
        agentPassword,
        adminKey,
        adminUrl: `${getBaseUrl(req)}/?admin=1`
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/agent-login') {
      const body = await readJson(req, MAX_JSON_BODY);
      if (cleanText(body.username, 80) !== agentUsername || cleanText(body.password, 120) !== agentPassword) {
        sendJson(res, 401, { error: 'invalid_credentials', message: 'Agent username or password is incorrect.' });
        return;
      }
      const authToken = `auth_${randomToken(18)}`;
      agentAuthTokens.set(authToken, {
        username: agentUsername,
        createdAt: isoNow()
      });
      sendJson(res, 200, {
        ok: true,
        authToken,
        username: agentUsername
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/metrics') {
      sendMetrics(res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      if (!isAgentAuthenticated(req)) {
        sendJson(res, 401, { error: 'agent_login_required', message: 'Sign in as an agent to create a session.' });
        return;
      }
      const body = await readJson(req, MAX_JSON_BODY);
      const session = createSession(body.agentName || 'Support Agent');
      const base = getBaseUrl(req);
      sendJson(res, 201, publicSession(session, {
        includePrivateLinks: true,
        baseUrl: base
      }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/demo-pack') {
      if (!isAgentAuthenticated(req)) {
        sendJson(res, 401, { error: 'agent_login_required', message: 'Sign in as an agent to generate judge credentials.' });
        return;
      }
      const base = getBaseUrl(req);
      const body = await readJson(req, MAX_JSON_BODY);
      const session = createSession(body.agentName || DEFAULT_DEMO_AGENT_NAME);
      session.participants.customer.name = cleanText(body.customerName, 80) || DEFAULT_DEMO_CUSTOMER_NAME;
      addEvent(
        session,
        'demo_pack_created',
        'system',
        'Judge access pack generated with agent, customer, and admin credentials.'
      );
      saveStore();
      sendJson(res, 201, publicDemoPack(session, base));
      return;
    }
    const inviteMatch = url.pathname.match(/^\/api\/invites\/([a-zA-Z0-9_-]+)$/);
    if (req.method === 'GET' && inviteMatch) {
      const session = findSessionByInvite(inviteMatch[1]);
      if (!session) {
        sendJson(res, 404, { error: 'invite_not_found', message: 'Invite token is invalid or expired.' });
        return;
      }
      sendJson(res, 200, {
        sessionId: session.id,
        status: session.status,
        createdAt: session.createdAt,
        agentName: session.participants.agent.name || 'Support Agent'
      });
      return;
    }
    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)$/);
    if (req.method === 'GET' && sessionMatch) {
      const session = store.sessions[sessionMatch[1]];
      const token = url.searchParams.get('token') || req.headers['x-session-token'];
      if (!session || !canReadSession(session, token, req)) {
        sendJson(res, 404, { error: 'session_not_found', message: 'Session was not found or token is invalid.' });
        return;
      }
      sendJson(res, 200, publicSession(session, { includeHistory: true, token }));
      return;
    }
    const endMatch = url.pathname.match(/^\/api\/sessions\/([a-zA-Z0-9_-]+)\/end$/);
    if (req.method === 'POST' && endMatch) {
      const session = store.sessions[endMatch[1]];
      const body = await readJson(req, MAX_JSON_BODY);
      if (!session || !canJoinWithToken(session, body.role, body.token)) {
        sendJson(res, 403, { error: 'forbidden', message: 'A valid participant token is required.' });
        return;
      }
      endSession(session, body.role || 'participant', 'Participant ended the call.');
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/admin/sessions') {
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: 'admin_key_required', message: 'Enter the admin key to open operations view.' });
        return;
      }
      const sessions = Object.values(store.sessions)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((session) => publicSession(session, { includeHistory: true, admin: true }));
      sendJson(res, 200, {
        sessions,
        metrics: computeMetrics()
      });
      return;
    }
    const adminEndMatch = url.pathname.match(/^\/api\/admin\/sessions\/([a-zA-Z0-9_-]+)\/end$/);
    if (req.method === 'POST' && adminEndMatch) {
      if (!isAdmin(req)) {
        sendJson(res, 401, { error: 'admin_key_required', message: 'Admin key is required.' });
        return;
      }
      const session = store.sessions[adminEndMatch[1]];
      if (!session) {
        sendJson(res, 404, { error: 'session_not_found', message: 'Session was not found.' });
        return;
      }
      endSession(session, 'admin', 'Admin ended the session.');
      sendJson(res, 200, { ok: true });
      return;
    }
    const fileMatch = url.pathname.match(/^\/api\/files\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/(.+)$/);
    if (req.method === 'GET' && fileMatch) {
      await serveSharedFile(req, res, fileMatch[1], fileMatch[2]);
      return;
    }
    const recordingMatch = url.pathname.match(/^\/api\/recordings\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/download$/);
    if (req.method === 'GET' && recordingMatch) {
      await serveRecording(req, res, recordingMatch[1], recordingMatch[2]);
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'not_found', message: 'API route not found.' });
      return;
    }
    if (req.method === 'GET') {
      await serveStatic(url.pathname, res);
      return;
    }
    sendJson(res, 404, { error: 'not_found', message: 'Route not found.' });
  }

  function createSession(agentName) {
    const now = isoNow();
    const id = `ses_${randomToken(8)}`;
    const session = {
      id,
      inviteToken: `inv_${randomToken(18)}`,
      agentToken: `agt_${randomToken(22)}`,
      status: 'waiting',
      createdAt: now,
      endedAt: null,
      participants: {
        agent: newParticipant('agent', cleanText(agentName, 80) || 'Support Agent'),
        customer: newParticipant('customer', 'Customer')
      },
      messages: [],
      files: [],
      events: [],
      recording: null
    };
    addEvent(session, 'session_created', 'agent', `Session created by ${session.participants.agent.name}.`);
    store.sessions[id] = session;
    saveStore();
    return session;
  }

  function newParticipant(role, name) {
    return {
      role,
      name,
      clientId: null,
      joinedAt: null,
      lastConnectedAt: null,
      disconnectedAt: null,
      lastSeenAt: null,
      connected: false,
      connectionId: null,
      totalMs: 0,
      audioMuted: false,
      videoOff: false
    };
  }

  function registerClient(socket) {
    const client = {
      id: `ws_${randomToken(12)}`,
      socket,
      buffer: Buffer.alloc(0),
      fragments: [],
      sessionId: null,
      role: null,
      clientId: null,
      closed: false
    };
    clients.set(client.id, client);
    socket.on('data', (chunk) => handleSocketData(client, chunk));
    socket.on('error', () => {
      // The close event performs participant cleanup.
    });
    socket.on('close', () => detachClient(client));
  }

  function handleSocketData(client, chunk) {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    while (client.buffer.length > 0) {
      const frame = parseFrame(client.buffer);
      if (!frame) return;
      client.buffer = client.buffer.subarray(frame.frameLength);
      if (frame.payload.length > MAX_WS_MESSAGE) {
        wsSend(client, { type: 'error', code: 'message_too_large', message: 'Message exceeds server limit.' });
        closeClient(client);
        return;
      }
      if (frame.opcode === 8) {
        closeClient(client);
        return;
      }
      if (frame.opcode === 9) {
        sendFrame(client.socket, frame.payload, 10);
        continue;
      }
      if (frame.opcode === 10) continue;
      if (frame.opcode === 0) {
        client.fragments.push(frame.payload);
        if (frame.fin) {
          const payload = Buffer.concat(client.fragments);
          client.fragments = [];
          handleWsText(client, payload.toString('utf8'));
        }
        continue;
      }
      if (frame.opcode === 1) {
        if (!frame.fin) {
          client.fragments = [frame.payload];
          continue;
        }
        handleWsText(client, frame.payload.toString('utf8'));
      }
    }
  }

  function handleWsText(client, text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch (error) {
      wsSend(client, { type: 'error', code: 'invalid_json', message: 'Malformed WebSocket payload.' });
      return;
    }
    routeWsMessage(client, message);
  }

  function routeWsMessage(client, message) {
    if (message.type !== 'join' && !client.sessionId) {
      wsSend(client, { type: 'error', code: 'join_required', message: 'Join a session before sending events.' });
      return;
    }
    const session = client.sessionId ? store.sessions[client.sessionId] : null;
    switch (message.type) {
      case 'join':
        joinSession(client, message);
        break;
      case 'chat:send':
        sendChatMessage(session, client, message);
        break;
      case 'file:upload':
        receiveFile(session, client, message);
        break;
      case 'media:start':
        forwardToSession(session.id, {
          type: 'media:start',
          from: client.role,
          mimeType: cleanText(message.mimeType, 100) || 'video/webm'
        }, client.id);
        break;
      case 'media:chunk':
        relayMediaChunk(session, client, message);
        break;
      case 'track:update':
        updateTrackState(session, client, message);
        break;
      case 'recording:start':
        if (client.role !== 'agent') {
          wsSend(client, { type: 'error', code: 'agent_only', message: 'Only the agent can start recording.' });
          return;
        }
        startRecording(session, client.role);
        broadcastRecording(session);
        break;
      case 'recording:stop':
        if (client.role !== 'agent') {
          wsSend(client, { type: 'error', code: 'agent_only', message: 'Only the agent can stop recording.' });
          return;
        }
        stopRecording(session, client.role);
        broadcastRecording(session);
        break;
      case 'session:end':
        if (client.role === 'agent') {
          endSession(session, client.role, `${client.role} ended the call.`);
        } else {
          leaveSession(session, client, `${client.role} left the call.`);
        }
        break;
      default:
        wsSend(client, { type: 'error', code: 'unknown_event', message: 'Unknown event type.' });
    }
  }

  function joinSession(client, message) {
    const role = message.role === 'agent' ? 'agent' : 'customer';
    const session = message.sessionId
      ? store.sessions[message.sessionId]
      : findSessionByInvite(message.token);
    if (!session || !canJoinWithToken(session, role, message.token)) {
      wsSend(client, { type: 'error', code: 'invalid_invite', message: 'Session token is invalid.' });
      return;
    }
    if (session.status === 'ended') {
      wsSend(client, { type: 'error', code: 'session_ended', message: 'This session has already ended.' });
      return;
    }

    const participant = session.participants[role];
    const requestedClientId = cleanText(message.clientId, 120) || `client_${randomToken(10)}`;
    const activeDifferentUser =
      participant.connected &&
      participant.connectionId &&
      participant.connectionId !== client.id &&
      participant.clientId &&
      participant.clientId !== requestedClientId;

    if (activeDifferentUser) {
      wsSend(client, {
        type: 'error',
        code: 'role_already_connected',
        message: `${role} is already connected in this session.`
      });
      return;
    }

    if (participant.connected && participant.connectionId && clients.has(participant.connectionId)) {
      const oldClient = clients.get(participant.connectionId);
      wsSend(oldClient, {
        type: 'info',
        code: 'superseded',
        message: 'A newer browser tab resumed this role.'
      });
      closeClient(oldClient);
    }

    const now = isoNow();
    const resumed = Boolean(
      participant.disconnectedAt &&
        Date.now() - new Date(participant.disconnectedAt).getTime() <= reconnectGraceMs &&
        participant.clientId === requestedClientId
    );
    const firstJoin = !participant.joinedAt;

    client.sessionId = session.id;
    client.role = role;
    client.clientId = requestedClientId;
    participant.name = cleanText(message.name, 80) || participant.name || role;
    participant.clientId = requestedClientId;
    participant.connected = true;
    participant.connectionId = client.id;
    participant.lastConnectedAt = now;
    participant.lastSeenAt = now;
    participant.disconnectedAt = null;
    if (!participant.joinedAt) participant.joinedAt = now;

    if (session.participants.agent.connected && session.participants.customer.connected) {
      session.status = 'active';
    }

    cancelGrace(session.id, role);
    if (resumed) {
      addEvent(session, 'participant_reconnected', role, `${participant.name} reconnected within the grace window.`);
    } else if (firstJoin) {
      addEvent(session, 'participant_joined', role, `${participant.name} joined as ${role}.`);
    } else {
      addEvent(session, 'participant_returned', role, `${participant.name} returned to the session.`);
    }
    saveStore();
    wsSend(client, {
      type: 'joined',
      role,
      clientId: requestedClientId,
      reconnectGraceMs,
      session: publicSession(session, { includeHistory: true, token: message.token })
    });
    if (!resumed) broadcastPresence(session);
  }

  function detachClient(client) {
    if (client.closed) return;
    client.closed = true;
    clients.delete(client.id);
    if (!client.sessionId || !client.role) return;
    const session = store.sessions[client.sessionId];
    if (!session) return;
    const participant = session.participants[client.role];
    if (!participant || participant.connectionId !== client.id) return;

    const now = isoNow();
    participant.connected = false;
    participant.connectionId = null;
    participant.disconnectedAt = now;
    participant.lastSeenAt = now;
    if (participant.lastConnectedAt) {
      participant.totalMs += Math.max(0, Date.now() - new Date(participant.lastConnectedAt).getTime());
    }
    participant.lastConnectedAt = null;
    saveStore();

    const timerKey = `${session.id}:${client.role}`;
    const timer = setTimeout(() => {
      const currentSession = store.sessions[session.id];
      if (!currentSession || currentSession.status === 'ended') return;
      const currentParticipant = currentSession.participants[client.role];
      if (!currentParticipant.connected && currentParticipant.disconnectedAt === now) {
        addEvent(
          currentSession,
          'participant_left',
          client.role,
          `${currentParticipant.name || client.role} left after reconnect grace expired.`
        );
        saveStore();
        broadcastPresence(currentSession);
      }
      graceTimers.delete(timerKey);
    }, reconnectGraceMs);
    graceTimers.set(timerKey, timer);
  }

  function sendChatMessage(session, client, message) {
    if (!session || session.status === 'ended') return;
    const text = cleanText(message.text, 2000);
    if (!text) {
      wsSend(client, { type: 'error', code: 'empty_message', message: 'Message cannot be empty.' });
      return;
    }
    const chat = {
      id: `msg_${randomToken(12)}`,
      type: 'text',
      role: client.role,
      name: session.participants[client.role].name,
      text,
      at: isoNow()
    };
    session.messages.push(chat);
    addEvent(session, 'chat_message', client.role, `${chat.name} sent a chat message.`);
    saveStore();
    forwardToSession(session.id, { type: 'chat:message', message: chat });
  }

  function receiveFile(session, client, message) {
    if (!session || session.status === 'ended') return;
    const originalName = cleanText(message.name, 160) || 'shared-file';
    const safeName = sanitizeFilename(originalName);
    const mimeType = cleanText(message.mimeType, 120) || 'application/octet-stream';
    const data = typeof message.data === 'string' ? message.data : '';
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
      wsSend(client, {
        type: 'error',
        code: 'file_size',
        message: 'File must be between 1 byte and 5 MB.'
      });
      return;
    }
    const fileId = `file_${randomToken(12)}`;
    const sessionUploadDir = path.join(uploadsDir, session.id);
    ensureDir(sessionUploadDir);
    const storedName = `${fileId}-${safeName}`;
    const storedPath = path.join(sessionUploadDir, storedName);
    fs.writeFileSync(storedPath, buffer);
    const fileRecord = {
      id: fileId,
      name: safeName,
      mimeType,
      size: buffer.length,
      role: client.role,
      nameLabel: session.participants[client.role].name,
      storedName,
      at: isoNow(),
      url: `/api/files/${session.id}/${fileId}/${encodeURIComponent(safeName)}`
    };
    session.files.push(fileRecord);
    const chat = {
      id: `msg_${randomToken(12)}`,
      type: 'file',
      role: client.role,
      name: session.participants[client.role].name,
      file: withoutStoredPath(fileRecord),
      at: fileRecord.at
    };
    session.messages.push(chat);
    addEvent(session, 'file_shared', client.role, `${fileRecord.nameLabel} shared ${safeName}.`);
    saveStore();
    sendMessageToSessionParticipants(session, {
      type: 'chat:message',
      buildMessage(token) {
        return publicMessage(chat, token);
      }
    });
  }

  function relayMediaChunk(session, client, message) {
    if (!session || session.status === 'ended') return;
    const data = typeof message.data === 'string' ? message.data : '';
    if (!data || data.length > MAX_WS_MESSAGE) return;
    if (session.recording?.status === 'in_progress') {
      appendRecordingChunk(session, client.role, data, message.mimeType || message.mime);
    }
    forwardToSession(session.id, {
      type: 'media:chunk',
      from: client.role,
      seq: Number(message.seq || 0),
      mimeType: cleanText(message.mimeType || message.mime, 100) || 'video/webm',
      data
    }, client.id);
  }

  function updateTrackState(session, client, message) {
    if (!session || session.status === 'ended') return;
    const participant = session.participants[client.role];
    participant.audioMuted = Boolean(message.audioMuted);
    participant.videoOff = Boolean(message.videoOff);
    participant.lastSeenAt = isoNow();
    saveStore();
    forwardToSession(session.id, {
      type: 'track:update',
      role: client.role,
      audioMuted: participant.audioMuted,
      videoOff: participant.videoOff
    }, client.id);
    broadcastPresence(session);
  }

  function startRecording(session, byRole) {
    if (!session || session.status === 'ended') return;
    if (session.recording?.status === 'in_progress') return;
    const recordingId = `rec_${randomToken(12)}`;
    const recordingDir = path.join(recordingsDir, session.id, recordingId);
    ensureDir(recordingDir);
    const now = isoNow();
    session.recording = {
      id: recordingId,
      status: 'in_progress',
      startedAt: now,
      stoppedAt: null,
      readyAt: null,
      error: null,
      archiveName: null,
      streams: {
        agent: { file: 'agent.webm', chunks: 0, bytes: 0, mimeType: null },
        customer: { file: 'customer.webm', chunks: 0, bytes: 0, mimeType: null }
      }
    };
    addEvent(session, 'recording_started', byRole, 'Recording started.');
    saveStore();
  }

  function appendRecordingChunk(session, role, data, mimeType) {
    const recording = session.recording;
    if (!recording || recording.status !== 'in_progress') return;
    const stream = recording.streams[role];
    if (!stream) return;
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return;
    const recordingDir = path.join(recordingsDir, session.id, recording.id);
    ensureDir(recordingDir);
    fs.appendFileSync(path.join(recordingDir, stream.file), buffer);
    stream.chunks += 1;
    stream.bytes += buffer.length;
    stream.mimeType = cleanText(mimeType, 120) || stream.mimeType || 'video/webm';
  }

  function stopRecording(session, byRole) {
    const recording = session?.recording;
    if (!recording || recording.status !== 'in_progress') return;
    recording.status = 'processing';
    recording.stoppedAt = isoNow();
    addEvent(session, 'recording_processing', byRole, 'Recording is being packaged.');
    saveStore();
    try {
      const recordingDir = path.join(recordingsDir, session.id, recording.id);
      ensureDir(recordingDir);
      const manifest = {
        sessionId: session.id,
        recordingId: recording.id,
        startedAt: recording.startedAt,
        stoppedAt: recording.stoppedAt,
        streams: recording.streams,
        messages: session.messages,
        events: session.events
      };
      const manifestPath = path.join(recordingDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      const archiveName = `${recording.id}.tar`;
      const archivePath = path.join(recordingDir, archiveName);
      const entries = [
        { name: 'manifest.json', path: manifestPath }
      ];
      for (const [role, stream] of Object.entries(recording.streams)) {
        const streamPath = path.join(recordingDir, stream.file);
        if (fs.existsSync(streamPath) && fs.statSync(streamPath).size > 0) {
          entries.push({ name: `${role}.webm`, path: streamPath });
        }
      }
      makeTarArchive(archivePath, entries);
      recording.status = 'ready';
      recording.readyAt = isoNow();
      recording.archiveName = archiveName;
      recording.error = null;
      addEvent(session, 'recording_ready', byRole, 'Recording archive is ready for download.');
    } catch (error) {
      recording.status = 'failed';
      recording.error = error.message;
      addEvent(session, 'recording_failed', byRole, 'Recording packaging failed.');
    }
    saveStore();
  }

  function endSession(session, byRole, reason) {
    if (!session || session.status === 'ended') return;
    if (session.recording?.status === 'in_progress') {
      stopRecording(session, byRole);
    }
    const now = isoNow();
    for (const participant of Object.values(session.participants)) {
      if (participant.connected && participant.lastConnectedAt) {
        participant.totalMs += Math.max(0, Date.now() - new Date(participant.lastConnectedAt).getTime());
      }
      participant.connected = false;
      participant.connectionId = null;
      participant.lastSeenAt = now;
      participant.disconnectedAt = now;
      participant.lastConnectedAt = null;
    }
    session.status = 'ended';
    session.endedAt = now;
    addEvent(session, 'session_ended', byRole, reason || 'Session ended.');
    saveStore();
    forwardToSession(session.id, {
      type: 'session:ended',
      session: publicSession(session, { includeHistory: true })
    });
    for (const client of clients.values()) {
      if (client.sessionId === session.id) closeClient(client);
    }
  }

  function leaveSession(session, client, reason) {
    if (!session || session.status === 'ended') return;
    const participant = session.participants[client.role];
    if (!participant) return;

    cancelGrace(session.id, client.role);
    const now = isoNow();
    if (participant.connected && participant.lastConnectedAt) {
      participant.totalMs += Math.max(0, Date.now() - new Date(participant.lastConnectedAt).getTime());
    }
    participant.connected = false;
    participant.connectionId = null;
    participant.lastSeenAt = now;
    participant.disconnectedAt = now;
    participant.lastConnectedAt = null;
    participant.audioMuted = false;
    participant.videoOff = false;

    if (!session.participants.customer.connected) {
      session.status = session.participants.agent.connected ? 'waiting' : 'waiting';
    }

    addEvent(session, 'participant_left', client.role, reason || `${client.role} left the call.`);
    saveStore();

    wsSend(client, {
      type: 'session:left',
      session: publicSession(session, { includeHistory: true, token: client.role === 'agent' ? session.agentToken : session.inviteToken })
    });
    broadcastPresence(session);
    closeClient(client);
  }

  function broadcastPresence(session) {
    forwardToSession(session.id, {
      type: 'presence:update',
      session: publicSession(session, { includeHistory: false })
    });
  }

  function broadcastRecording(session) {
    forwardToSession(session.id, {
      type: 'recording:update',
      recording: publicRecording(session.recording)
    });
  }

  function sendMessageToSessionParticipants(session, envelope) {
    for (const client of clients.values()) {
      if (client.sessionId !== session.id) continue;
      const token = client.role === 'agent' ? session.agentToken : session.inviteToken;
      wsSend(client, {
        type: envelope.type,
        message: envelope.buildMessage(token)
      });
    }
  }

  function forwardToSession(sessionId, message, exceptClientId = null) {
    for (const client of clients.values()) {
      if (client.sessionId === sessionId && client.id !== exceptClientId) {
        wsSend(client, message);
      }
    }
  }

  function closeClient(client) {
    if (!client || client.closed) return;
    try {
      sendFrame(client.socket, Buffer.alloc(0), 8);
    } catch (_) {
      // Ignore close-frame errors during shutdown.
    }
    client.socket.end();
    detachClient(client);
  }

  function wsSend(client, payload) {
    if (!client || client.closed || !client.socket.writable) return;
    sendFrame(client.socket, Buffer.from(JSON.stringify(payload), 'utf8'), 1);
  }

  function sendFrame(socket, payload, opcode = 1) {
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.alloc(2);
      header[1] = length;
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    header[0] = 0x80 | opcode;
    socket.write(Buffer.concat([header, payload]));
  }

  function parseFrame(buffer) {
    if (buffer.length < 2) return null;
    const first = buffer[0];
    const second = buffer[1];
    const fin = Boolean(first & 0x80);
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let payloadLength = second & 0x7f;
    let offset = 2;
    if (payloadLength === 126) {
      if (buffer.length < offset + 2) return null;
      payloadLength = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (buffer.length < offset + 8) return null;
      const bigLength = buffer.readBigUInt64BE(offset);
      if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      payloadLength = Number(bigLength);
      offset += 8;
    }
    let mask;
    if (masked) {
      if (buffer.length < offset + 4) return null;
      mask = buffer.subarray(offset, offset + 4);
      offset += 4;
    }
    if (buffer.length < offset + payloadLength) return null;
    const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
    if (masked) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }
    return {
      fin,
      opcode,
      payload,
      frameLength: offset + payloadLength
    };
  }

  function addEvent(session, type, role, detail) {
    session.events.push({
      id: `evt_${randomToken(12)}`,
      type,
      role,
      detail,
      at: isoNow()
    });
  }

  function findSessionByInvite(token) {
    return Object.values(store.sessions).find((session) => session.inviteToken === token);
  }

  function canJoinWithToken(session, role, token) {
    if (!session || !token) return false;
    if (role === 'agent') return token === session.agentToken;
    if (role === 'customer') return token === session.inviteToken;
    return false;
  }

  function canReadSession(session, token, req) {
    return token === session.agentToken || token === session.inviteToken || isAdmin(req);
  }

  function isAdmin(req) {
    const key = req.headers['x-admin-key'] || new URL(req.url, 'http://localhost').searchParams.get('adminKey');
    return key && key === adminKey;
  }

  function isAgentAuthenticated(req) {
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const fallbackToken = req.headers['x-agent-auth'];
    const token = headerToken || fallbackToken;
    return Boolean(token && agentAuthTokens.has(token));
  }

  async function serveSharedFile(req, res, sessionId, fileId) {
    const session = store.sessions[sessionId];
    const token = new URL(req.url, 'http://localhost').searchParams.get('token') || req.headers['x-session-token'];
    if (!session || !canReadSession(session, token, req)) {
      sendJson(res, 403, { error: 'forbidden', message: 'Valid session token is required.' });
      return;
    }
    const file = session.files.find((item) => item.id === fileId);
    if (!file) {
      sendJson(res, 404, { error: 'file_not_found', message: 'Shared file was not found.' });
      return;
    }
    const filePath = path.resolve(uploadsDir, sessionId, file.storedName);
    if (!isPathInside(filePath, uploadsDir)) {
      sendJson(res, 403, { error: 'forbidden', message: 'Invalid file path.' });
      return;
    }
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'file_missing', message: 'Shared file is missing on disk.' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': file.mimeType,
      'Content-Length': fs.statSync(filePath).size,
      'Content-Disposition': `attachment; filename="${escapeHeader(file.name)}"`
    });
    fs.createReadStream(filePath).pipe(res);
  }

  async function serveRecording(req, res, sessionId, recordingId) {
    const session = store.sessions[sessionId];
    const token = new URL(req.url, 'http://localhost').searchParams.get('token') || req.headers['x-session-token'];
    if (!session || !(token === session.agentToken || isAdmin(req))) {
      sendJson(res, 403, { error: 'forbidden', message: 'Agent token or admin key is required.' });
      return;
    }
    const recording = session.recording;
    if (!recording || recording.id !== recordingId || recording.status !== 'ready') {
      sendJson(res, 404, { error: 'recording_not_ready', message: 'Recording is not ready.' });
      return;
    }
    const archivePath = path.resolve(recordingsDir, sessionId, recordingId, recording.archiveName);
    if (!isPathInside(archivePath, recordingsDir) || !fs.existsSync(archivePath)) {
      sendJson(res, 404, { error: 'recording_missing', message: 'Recording archive is missing.' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/x-tar',
      'Content-Length': fs.statSync(archivePath).size,
      'Content-Disposition': `attachment; filename="${escapeHeader(recording.archiveName)}"`
    });
    fs.createReadStream(archivePath).pipe(res);
  }

  async function serveStatic(urlPath, res) {
    const requestedPath = urlPath === '/' ? '/index.html' : decodeURIComponent(urlPath);
    const roots = [
      { prefix: '/docs/', dir: DOCS_DIR, strip: '/docs/' },
      { prefix: '/', dir: PUBLIC_DIR, strip: '/' }
    ];
    const root = roots.find((item) => requestedPath.startsWith(item.prefix));
    if (!root) {
      sendJson(res, 404, { error: 'not_found', message: 'Static asset was not found.' });
      return;
    }
    const relative = requestedPath.slice(root.strip.length);
    const resolved = path.resolve(root.dir, relative);
    if (!isPathInside(resolved, root.dir)) {
      sendJson(res, 403, { error: 'forbidden', message: 'Invalid static path.' });
      return;
    }
    let filePath = resolved;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
    });
    fs.createReadStream(filePath).pipe(res);
  }

  function sendMetrics(res) {
    const metrics = computeMetrics();
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AtomLens Metrics</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #0f1419 0%, #1a2634 100%); color: #e8f1f8; min-height: 100vh; padding: 2rem; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 3rem; }
    header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    header p { font-size: 1rem; color: #a0adb8; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
    .metric-card { background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 2rem; transition: all 0.3s ease; }
    .metric-card:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }
    .metric-value { font-size: 3rem; font-weight: bold; color: #00d4ff; margin-bottom: 0.5rem; }
    .metric-label { font-size: 0.9rem; color: #a0adb8; text-transform: uppercase; letter-spacing: 1px; }
    .metric-description { font-size: 0.85rem; color: #7a8a99; margin-top: 1rem; }
    .status-ok { color: #10c464; }
    .status-warn { color: #ffa500; }
    .status-error { color: #ff6b6b; }
    .details { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 2rem; }
    .details h2 { margin-bottom: 1rem; font-size: 1.3rem; }
    .details-row { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    .details-row:last-child { border-bottom: none; }
    .details-label { color: #a0adb8; }
    .details-value { font-weight: bold; color: #00d4ff; }
    .footer { text-align: center; margin-top: 3rem; color: #7a8a99; font-size: 0.85rem; }
    .refresh-hint { background: rgba(0, 212, 255, 0.1); border-left: 3px solid #00d4ff; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📊 AtomLens Metrics Dashboard</h1>
      <p>Real-time system performance and usage statistics</p>
    </header>
    
    <div class="refresh-hint">
      💡 This page refreshes every 5 seconds. Leave it open to monitor live activity.
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-value ${metrics.activeSessions > 0 ? 'status-ok' : ''}">${metrics.activeSessions}</div>
        <div class="metric-label">Active Sessions</div>
        <div class="metric-description">Ongoing support sessions not yet ended</div>
      </div>

      <div class="metric-card">
        <div class="metric-value ${metrics.connectedParticipants > 0 ? 'status-ok' : ''}">${metrics.connectedParticipants}</div>
        <div class="metric-label">Connected Participants</div>
        <div class="metric-description">Users currently in active video calls</div>
      </div>

      <div class="metric-card">
        <div class="metric-value">${metrics.totalSessions}</div>
        <div class="metric-label">Total Sessions</div>
        <div class="metric-description">All sessions created (active + ended)</div>
      </div>

      <div class="metric-card">
        <div class="metric-value">${metrics.totalMessages}</div>
        <div class="metric-label">Total Messages</div>
        <div class="metric-description">Chat messages and file shares</div>
      </div>

      <div class="metric-card">
        <div class="metric-value ${metrics.errors === 0 ? 'status-ok' : 'status-error'}">${metrics.errors}</div>
        <div class="metric-label">Server Errors</div>
        <div class="metric-description ${metrics.errors === 0 ? '' : 'status-error'}">${metrics.errors === 0 ? '✓ No errors' : 'Errors detected'}</div>
      </div>
    </div>

    <div class="details">
      <h2>📈 Summary</h2>
      <div class="details-row">
        <span class="details-label">Service Status</span>
        <span class="details-value status-ok">✓ Running</span>
      </div>
      <div class="details-row">
        <span class="details-label">Active Sessions</span>
        <span class="details-value">${metrics.activeSessions} / ${metrics.totalSessions}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Connected Users</span>
        <span class="details-value">${metrics.connectedParticipants}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Chat Activity</span>
        <span class="details-value">${metrics.totalMessages} messages</span>
      </div>
      <div class="details-row">
        <span class="details-label">System Health</span>
        <span class="details-value ${metrics.errors === 0 ? 'status-ok' : 'status-error'}">${metrics.errors === 0 ? '✓ Healthy' : '⚠ Issues detected'}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Last Updated</span>
        <span class="details-value" id="updated">${new Date().toLocaleTimeString()}</span>
      </div>
    </div>

    <div class="footer">
      <p>AtomLens Relay • Real-time Video Support Platform</p>
      <p style="margin-top: 1rem; font-size: 0.75rem; color: #5a6a79;">Page auto-refreshes every 5 seconds • View source for Prometheus format</p>
    </div>
  </div>

  <script>
    setInterval(() => {
      location.reload();
    }, 5000);
  </script>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  function computeMetrics() {
    const sessions = Object.values(store.sessions);
    return {
      activeSessions: sessions.filter((session) => session.status !== 'ended').length,
      connectedParticipants: sessions.reduce((sum, session) => {
        return sum + Object.values(session.participants).filter((participant) => participant.connected).length;
      }, 0),
      totalSessions: sessions.length,
      totalMessages: sessions.reduce((sum, session) => sum + session.messages.length, 0),
      errors: store.counters.errors
    };
  }

  function publicSession(session, options = {}) {
    const includeHistory = Boolean(options.includeHistory);
    const baseUrl = options.baseUrl || '';
    const token = options.token || '';
    const publicFiles = session.files.map(withoutStoredPath);
    return {
      id: session.id,
      status: session.status,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
      inviteUrl: options.includePrivateLinks
        ? `${baseUrl}/?invite=${encodeURIComponent(session.inviteToken)}`
        : undefined,
      agentUrl: options.includePrivateLinks
        ? `${baseUrl}/?session=${encodeURIComponent(session.id)}&role=agent&token=${encodeURIComponent(session.agentToken)}`
        : undefined,
      inviteToken: options.includePrivateLinks ? session.inviteToken : undefined,
      agentToken: options.includePrivateLinks ? session.agentToken : undefined,
      participants: Object.fromEntries(
        Object.entries(session.participants).map(([role, participant]) => [
          role,
          publicParticipant(participant)
        ])
      ),
      recording: publicRecording(session.recording),
      messages: includeHistory ? session.messages.map((message) => publicMessage(message, token)) : undefined,
      files: includeHistory ? publicFiles : undefined,
      events: includeHistory ? session.events : undefined
    };
  }

  function publicParticipant(participant) {
    return {
      role: participant.role,
      name: participant.name,
      joinedAt: participant.joinedAt,
      lastSeenAt: participant.lastSeenAt,
      connected: participant.connected,
      disconnectedAt: participant.disconnectedAt,
      totalMs: participant.totalMs + (participant.connected && participant.lastConnectedAt
        ? Date.now() - new Date(participant.lastConnectedAt).getTime()
        : 0),
      audioMuted: participant.audioMuted,
      videoOff: participant.videoOff
    };
  }

  function publicDemoPack(session, baseUrl) {
    return {
      sessionId: session.id,
      agentName: session.participants.agent.name,
      customerName: session.participants.customer.name,
      agentRole: 'Call Agent',
      customerRole: 'Customer',
      agentToken: session.agentToken,
      customerInviteToken: session.inviteToken,
      agentJoinUrl: `${baseUrl}/?session=${encodeURIComponent(session.id)}&role=agent&token=${encodeURIComponent(session.agentToken)}`,
      customerJoinUrl: `${baseUrl}/?invite=${encodeURIComponent(session.inviteToken)}`,
      adminDashboardUrl: `${baseUrl}/?admin=1`,
      adminKey
    };
  }

  function publicRecording(recording) {
    if (!recording) return null;
    return {
      id: recording.id,
      status: recording.status,
      startedAt: recording.startedAt,
      stoppedAt: recording.stoppedAt,
      readyAt: recording.readyAt,
      error: recording.error,
      archiveName: recording.archiveName,
      streams: recording.streams
    };
  }

  function publicMessage(message, token) {
    if (message.type !== 'file') return message;
    return {
      ...message,
      file: {
        ...message.file,
        url: token ? `${message.file.url}?token=${encodeURIComponent(token)}` : message.file.url
      }
    };
  }

  function withoutStoredPath(file) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      role: file.role,
      nameLabel: file.nameLabel,
      at: file.at,
      url: file.url
    };
  }

  function cancelGrace(sessionId, role) {
    const key = `${sessionId}:${role}`;
    if (graceTimers.has(key)) {
      clearTimeout(graceTimers.get(key));
      graceTimers.delete(key);
    }
  }

  function getBaseUrl(req) {
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `localhost:${DEFAULT_PORT}`;
    return `${proto}://${host}`;
  }

  function listen(port = DEFAULT_PORT, host = DEFAULT_HOST) {
    return new Promise((resolve) => {
      server.listen(port, host, () => resolve(server));
    });
  }

  function close() {
    for (const timer of graceTimers.values()) clearTimeout(timer);
    for (const client of clients.values()) closeClient(client);
    return new Promise((resolve) => server.close(resolve));
  }

  return {
    server,
    listen,
    close,
    state: {
      get store() {
        return store;
      },
      clients
    },
    paths: { dataDir, uploadsDir, recordingsDir, storePath },
    adminKey
  };
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function isoNow() {
  return new Date().toISOString();
}

function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function sanitizeFilename(value) {
  const cleaned = cleanText(value, 160)
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'shared-file';
}

function escapeHeader(value) {
  return String(value).replace(/["\\]/g, '_');
}

function isPathInside(childPath, parentPath) {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function makeTarArchive(outputPath, entries) {
  const fd = fs.openSync(outputPath, 'w');
  try {
    for (const entry of entries) {
      const stat = fs.statSync(entry.path);
      const header = tarHeader(entry.name, stat.size, Math.floor(stat.mtimeMs / 1000));
      fs.writeSync(fd, header);
      const data = fs.readFileSync(entry.path);
      fs.writeSync(fd, data);
      const padding = (512 - (stat.size % 512)) % 512;
      if (padding) fs.writeSync(fd, Buffer.alloc(padding));
    }
    fs.writeSync(fd, Buffer.alloc(1024));
  } finally {
    fs.closeSync(fd);
  }
}

function tarHeader(name, size, mtime) {
  const header = Buffer.alloc(512, 0);
  writeTarString(header, name, 0, 100);
  writeTarOctal(header, 0o644, 100, 8);
  writeTarOctal(header, 0, 108, 8);
  writeTarOctal(header, 0, 116, 8);
  writeTarOctal(header, size, 124, 12);
  writeTarOctal(header, mtime, 136, 12);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeTarString(header, 'ustar', 257, 6);
  writeTarString(header, '00', 263, 2);
  writeTarString(header, 'atomlens', 265, 32);
  writeTarString(header, 'atomlens', 297, 32);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarOctal(header, checksum, 148, 8);
  return header;
}

function writeTarString(buffer, value, offset, length) {
  const text = Buffer.from(value, 'utf8');
  text.copy(buffer, offset, 0, Math.min(text.length, length));
}

function writeTarOctal(buffer, value, offset, length) {
  const text = value.toString(8).padStart(length - 1, '0').slice(0, length - 1);
  buffer.write(text, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

if (require.main === module) {
  const platform = createPlatform();
  platform.listen(DEFAULT_PORT, DEFAULT_HOST).then(() => {
    console.log(`AtomLens Relay running on http://localhost:${DEFAULT_PORT}`);
    console.log(`Admin key: ${platform.adminKey}`);
  });
}

module.exports = {
  createPlatform,
  makeTarArchive,
  sanitizeFilename
};
