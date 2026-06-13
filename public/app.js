const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const params = new URLSearchParams(location.search);

const AUTH_STORAGE_KEY = 'atomlens-agent-auth';

const state = {
  ws: null,
  session: null,
  role: params.get('role') || null,
  token: params.get('token') || null,
  localStream: null,
  mediaRecorder: null,
  mediaSeq: 0,
  browserRecording: {
    recorder: null,
    chunks: [],
    blobUrl: '',
    filename: '',
    stream: null,
    animationFrame: 0,
    canvas: null,
    audioContext: null
  },
  accessInfo: null,
  auth: readStoredAuth(),
  remote: {
    mediaSource: null,
    sourceBuffer: null,
    queue: [],
    objectUrl: null,
    mimeType: null
  },
  audioMuted: false,
  videoOff: false
};

window.addEventListener('beforeunload', () => {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((track) => track.stop());
  }
});

route();

async function route() {
  state.accessInfo = await fetchAccessInfo();
  if (params.has('admin')) {
    renderAdmin();
    return;
  }
  if (params.get('invite')) {
    renderCustomerJoin(params.get('invite'));
    return;
  }
  if (params.get('session') && params.get('role') && params.get('token')) {
    renderCallShell({
      sessionId: params.get('session'),
      role: params.get('role'),
      token: params.get('token')
    });
    return;
  }
  if (!state.auth) {
    renderAgentLogin();
    return;
  }
  renderAgentConsole();
}

function renderAgentLogin() {
  app.innerHTML = `
    <section class="login-shell">
      <div class="login-hero">
        <span class="eyebrow">AtomLens Relay</span>
        <h1 class="hero-title">Agent sign in for secure video support</h1>
        <p class="lead hero-copy">Clean support workflow for agents, browser access for customers, and recording downloads after every completed session.</p>
        <div class="hero-list">
          <div class="hero-item">
            <strong>Credential login</strong>
            <span>Agent dashboard opens only after username and password sign-in.</span>
          </div>
          <div class="hero-item">
            <strong>End-of-session recording</strong>
            <span>When a recording exists, the download action stays visible after the session ends.</span>
          </div>
          <div class="hero-item">
            <strong>Two-role support flow</strong>
            <span>Agents create the room, customers join with an invite, and admin can monitor operations.</span>
          </div>
        </div>
      </div>
      <div class="login-card">
        <span class="eyebrow">Agent Access</span>
        <h2 class="section-title">Sign in</h2>
        <p class="lead">Use the agent credentials below for the local demo, then create or manage support sessions.</p>
        <form id="agent-login" class="form-stack">
          <label>
            Username
            <input name="username" autocomplete="username" value="${escapeAttr(state.accessInfo?.agentUsername || '')}">
          </label>
          <label>
            Password
            <input name="password" type="password" autocomplete="current-password" value="${escapeAttr(state.accessInfo?.agentPassword || '')}">
          </label>
          <button type="submit">Sign In as Agent</button>
        </form>
        <div class="credential-box">
          <div>
            <span>Demo username</span>
            <strong>${escapeHtml(state.accessInfo?.agentUsername || 'agent')}</strong>
          </div>
          <div>
            <span>Demo password</span>
            <strong>${escapeHtml(state.accessInfo?.agentPassword || 'atomlens123')}</strong>
          </div>
        </div>
      </div>
    </section>
  `;
  document.querySelector('#agent-login').addEventListener('submit', loginAgent);
}

async function loginAgent(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/agent-login', {
      method: 'POST',
      body: {
        username: form.get('username'),
        password: form.get('password')
      }
    });
    state.auth = {
      token: data.authToken,
      username: data.username
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state.auth));
    renderAgentConsole();
    showToast('Agent login successful.');
  } catch (error) {
    showToast(error.message);
  }
}

function logoutAgent() {
  state.auth = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  renderAgentLogin();
}

function renderAgentConsole() {
  app.innerHTML = `
    <section class="dashboard-shell">
      <div class="hero-banner">
        <div>
          <span class="eyebrow">Agent Workspace</span>
          <h1 class="hero-title">Create sessions, share invite access, and manage recordings cleanly</h1>
          <p class="lead hero-copy">Signed in as <strong>${escapeHtml(state.auth.username)}</strong>. This dashboard keeps credentials, session creation, and judge-ready access details in one place.</p>
        </div>
        <div class="hero-actions">
          <button id="logout-agent" class="ghost">Sign Out</button>
          <a class="button-link secondary-link" href="/?admin=1">Open Admin</a>
        </div>
      </div>

      <section class="dashboard-grid">
        <div class="panel feature-panel">
          <span class="eyebrow">Session Builder</span>
          <h2 class="section-title">Create a support room</h2>
          <p class="lead">Generate the live support room, then open the agent view and send the invite link to the customer.</p>
          <form id="create-session" class="form-stack">
            <label>
              Agent display name
              <input name="agentName" value="Support Agent" autocomplete="name">
            </label>
            <button type="submit">Create Session</button>
          </form>
          <div id="session-result" class="session-result"></div>
        </div>

        <div class="panel feature-panel">
          <span class="eyebrow">Judge Credentials</span>
          <h2 class="section-title">Generate judge access pack</h2>
          <p class="lead">Produce a clean credential bundle for judging with agent access, customer access, and admin login details.</p>
          <form id="create-demo-pack" class="form-stack">
            <label>
              Agent label
              <input name="agentName" value="Judge Agent" autocomplete="name">
            </label>
            <label>
              Customer label
              <input name="customerName" value="Judge Customer" autocomplete="name">
            </label>
            <button type="submit" class="secondary">Generate Judge Credentials</button>
          </form>
          <div id="demo-pack-result" class="session-result"></div>
        </div>
      </section>

      <section class="two-column">
        <div class="panel">
          <span class="eyebrow">How access works</span>
          <h2 class="section-title">Credentials and roles</h2>
          <div class="status-grid">
            ${metric('Agent login', `${state.accessInfo?.agentUsername || 'agent'} / ${state.accessInfo?.agentPassword || 'atomlens123'}`)}
            ${metric('Admin key', state.accessInfo?.adminKey || 'demo-admin-key')}
            ${metric('Customer access', 'Invite URL')}
            ${metric('Recording', 'Download after end')}
          </div>
        </div>
        <div class="panel">
          <span class="eyebrow">Live capabilities</span>
          <h2 class="section-title">Support workflow</h2>
          <div class="story-list">
            ${storyItem('Server-routed media', 'Audio and video are streamed through this project server.')}
            ${storyItem('In-call collaboration', 'Chat, file sharing, mute, and camera controls stay in one clean workspace.')}
            ${storyItem('Post-call review', 'Recording archive remains downloadable after the session ends.')}
          </div>
        </div>
      </section>
    </section>
  `;
  document.querySelector('#logout-agent').addEventListener('click', logoutAgent);
  document.querySelector('#create-session').addEventListener('submit', createSession);
  document.querySelector('#create-demo-pack').addEventListener('submit', createDemoPack);
}

async function createSession(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = document.querySelector('#session-result');
  result.innerHTML = '<div class="empty">Creating secure session...</div>';
  try {
    const session = await api('/api/sessions', {
      method: 'POST',
      body: { agentName: form.get('agentName') }
    });
    result.innerHTML = `
      <div class="card result-card">
        <div class="card-head">
          <span class="badge ok">Session ready</span>
          <h3>${escapeHtml(session.id)}</h3>
        </div>
        <div class="form-stack">
          ${copyField('Agent link', session.agentUrl)}
          ${copyField('Customer invite', session.inviteUrl)}
        </div>
        <div class="actions">
          <a class="button-link" href="${escapeAttr(session.agentUrl)}">Open agent room</a>
          <button class="secondary" data-copy="${escapeAttr(session.inviteUrl)}">Copy customer invite</button>
        </div>
      </div>
    `;
    bindCopyButtons(result);
  } catch (error) {
    result.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function createDemoPack(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = document.querySelector('#demo-pack-result');
  result.innerHTML = '<div class="empty">Generating judge credentials...</div>';
  try {
    const pack = await api('/api/demo-pack', {
      method: 'POST',
      body: {
        agentName: form.get('agentName'),
        customerName: form.get('customerName')
      }
    });
    result.innerHTML = `
      <div class="card result-card">
        <div class="card-head">
          <span class="badge ok">Judge pack ready</span>
          <h3>${escapeHtml(pack.sessionId)}</h3>
        </div>
        <div class="form-stack">
          ${copyField('Agent access URL', pack.agentJoinUrl)}
          ${copyField('Customer access URL', pack.customerJoinUrl)}
          ${copyField('Admin dashboard URL', pack.adminDashboardUrl)}
          ${copyField('Admin key', pack.adminKey)}
          ${copyField('Agent login username', state.accessInfo?.agentUsername || 'agent')}
          ${copyField('Agent login password', state.accessInfo?.agentPassword || 'atomlens123')}
        </div>
        <div class="actions">
          <a class="button-link" href="${escapeAttr(pack.agentJoinUrl)}">Open agent view</a>
          <a class="button-link secondary-link" href="${escapeAttr(pack.customerJoinUrl)}">Open customer view</a>
        </div>
      </div>
    `;
    bindCopyButtons(result);
  } catch (error) {
    result.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function renderCustomerJoin(inviteToken) {
  app.innerHTML = '<section class="panel"><div class="empty">Checking invite...</div></section>';
  try {
    const invite = await api(`/api/invites/${encodeURIComponent(inviteToken)}`);
    app.innerHTML = `
      <section class="join-shell">
        <div class="panel feature-panel">
          <span class="eyebrow">Customer Access</span>
          <h1 class="section-title">Join ${escapeHtml(invite.agentName)}'s support call</h1>
          <p class="lead">No installation is required. Enter your display name and the browser will prompt for camera and microphone access when you join.</p>
          <form id="join-customer" class="form-stack">
            <label>
              Your name
              <input name="name" value="Customer" autocomplete="name">
            </label>
            <button type="submit">Join Call</button>
          </form>
        </div>
        <aside class="panel">
          <span class="eyebrow">Session Info</span>
          <h2 class="section-title">Invite validated</h2>
          <div class="status-grid">
            ${metric('Status', invite.status)}
            ${metric('Session', invite.sessionId)}
          </div>
        </aside>
      </section>
    `;
    document.querySelector('#join-customer').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get('name') || 'Customer';
      renderCallShell({
        sessionId: invite.sessionId,
        role: 'customer',
        token: inviteToken,
        name
      });
    });
  } catch (error) {
    app.innerHTML = `<section class="panel"><div class="empty">${escapeHtml(error.message)}</div></section>`;
  }
}

async function renderCallShell({ sessionId, role, token, name }) {
  state.role = role;
  state.token = token;
  app.innerHTML = `
    <section class="call-page">
      <div class="call-header panel">
        <div>
          <span id="call-status" class="badge warn">Not connected</span>
          <h1 class="section-title">Support session ${escapeHtml(sessionId)}</h1>
          <p class="lead" id="session-summary">Prepare camera and microphone to join as ${escapeHtml(role)}.</p>
        </div>
        <button id="join-call">Join Call</button>
      </div>

      <section class="call-layout">
        <div class="stage">
          <div class="video-stage">
            <figure class="video-tile video-primary">
              <div class="video-surface">
                <video id="remote-video" autoplay playsinline controls></video>
              </div>
              <figcaption class="video-caption">
                <span>Remote participant</span>
                <span id="remote-flags" class="subtle"></span>
              </figcaption>
            </figure>
            <figure class="video-tile video-secondary">
              <div class="video-surface">
                <video id="local-video" autoplay muted playsinline></video>
              </div>
              <figcaption class="video-caption">
                <span>You</span>
                <span id="local-flags" class="subtle"></span>
              </figcaption>
            </figure>
          </div>

          <div class="panel control-panel">
            <div class="panel-head compact-head">
              <span class="eyebrow">Call Controls</span>
              <h2 class="section-title">Manage the live session</h2>
            </div>
            <div class="control-bar">
              <button id="mute-audio" class="ghost" disabled>Mute Audio</button>
              <button id="toggle-video" class="ghost" disabled>Turn Video Off</button>
              ${role === 'agent' ? '<button id="record-toggle" class="secondary" disabled>Start Recording</button>' : ''}
              <button id="end-call" class="danger" disabled>End Call</button>
            </div>
            <div id="recording-status-wrap" class="recording-chip-wrap">
              <span id="recording-status" class="badge">Recording idle</span>
            </div>
          </div>

          <div id="session-summary-card"></div>
        </div>

        <aside class="sidebar">
          <div class="panel chat-box">
            <div class="panel-head">
              <span class="eyebrow">Conversation</span>
              <h2 class="section-title">Chat and files</h2>
            </div>
            <div id="messages" class="messages"></div>
            <form id="chat-form" class="chat-actions">
              <textarea name="text" placeholder="Send a message during the call"></textarea>
              <div class="file-row">
                <input id="file-input" type="file" aria-label="Share file">
                <button type="submit" disabled id="send-chat">Send</button>
              </div>
            </form>
          </div>

          <div class="panel">
            <div class="panel-head">
              <span class="eyebrow">Activity</span>
              <h2 class="section-title">Session trail</h2>
            </div>
            <div id="timeline" class="timeline"></div>
          </div>
        </aside>
      </section>
    </section>
  `;
  bindCallControls({ sessionId, role, token, name });
  await loadSession(sessionId, token);
}

function bindCallControls({ sessionId, role, token, name }) {
  document.querySelector('#join-call').addEventListener('click', () => joinCall({ sessionId, role, token, name }));
  document.querySelector('#mute-audio').addEventListener('click', toggleAudio);
  document.querySelector('#toggle-video').addEventListener('click', toggleVideo);
  document.querySelector('#end-call').addEventListener('click', () => sendWs({ type: 'session:end' }));
  document.querySelector('#chat-form').addEventListener('submit', sendChat);
  document.querySelector('#file-input').addEventListener('change', sendFile);
  const recordButton = document.querySelector('#record-toggle');
  if (recordButton) {
    recordButton.addEventListener('click', () => {
      const recording = state.session?.recording;
      if (recording?.status === 'in_progress') {
        sendWs({ type: 'recording:stop' });
      } else {
        sendWs({ type: 'recording:start' });
      }
    });
  }
}

async function loadSession(sessionId, token) {
  try {
    const session = await api(`/api/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`);
    state.session = session;
    renderSessionState(session);
  } catch (error) {
    showToast(error.message);
  }
}

async function joinCall({ sessionId, role, token, name }) {
  const joinButton = document.querySelector('#join-call');
  joinButton.disabled = true;
  joinButton.textContent = 'Opening devices...';
  try {
    await startLocalMedia();
    joinButton.textContent = 'Connecting...';
    openSocket({ sessionId, role, token, name });
  } catch (error) {
    joinButton.disabled = false;
    joinButton.textContent = 'Join Call';
    showToast(error.message || 'Could not open camera or microphone.');
  }
}

async function startLocalMedia() {
  if (state.localStream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser does not support camera and microphone capture.');
  }
  state.localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      width: { ideal: 960 },
      height: { ideal: 540 },
      frameRate: { ideal: 24, max: 30 }
    }
  });
  document.querySelector('#local-video').srcObject = state.localStream;
}

function openSocket({ sessionId, role, token, name }) {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  state.ws = ws;
  ws.addEventListener('open', () => {
    sendWs({
      type: 'join',
      sessionId,
      role,
      token,
      name: name || roleLabel(role),
      clientId: getClientId(sessionId, role)
    });
  });
  ws.addEventListener('message', handleSocketMessage);
  ws.addEventListener('close', () => {
    stopRecorder();
    if (state.session?.status === 'ended') {
      setCallStatus('Ended', 'danger');
      enableCallControls(false);
      return;
    }
    setCallStatus('Disconnected', 'danger');
    document.querySelector('#join-call').disabled = false;
    document.querySelector('#join-call').textContent = 'Reconnect';
  });
  ws.addEventListener('error', () => {
    showToast('WebSocket connection failed.');
  });
}

function handleSocketMessage(event) {
  const message = JSON.parse(event.data);
  if (message.type === 'error') {
    showToast(message.message || message.code);
    return;
  }
  if (message.type === 'joined') {
    state.session = message.session;
    renderSessionState(message.session);
    setCallStatus('Connected', 'ok');
    enableCallControls(true);
    startRecorder();
    return;
  }
  if (message.type === 'presence:update') {
    state.session = { ...state.session, ...message.session };
    renderSessionState(state.session);
    return;
  }
  if (message.type === 'chat:message') {
    state.session.messages = [...(state.session.messages || []), hydrateMessage(message.message)];
    renderMessages(state.session.messages);
    renderSessionSummaryCard(state.session);
    return;
  }
  if (message.type === 'media:start') {
    setupRemoteMedia(message.mimeType);
    return;
  }
  if (message.type === 'media:chunk') {
    appendRemoteChunk(message.data, message.mimeType);
    return;
  }
  if (message.type === 'track:update') {
    updateRemoteFlags(message);
    return;
  }
  if (message.type === 'recording:update') {
    state.session.recording = message.recording;
    syncBrowserRecording(message.recording);
    renderRecording(message.recording);
    renderSessionSummaryCard(state.session);
    return;
  }
  if (message.type === 'session:left') {
    state.session = message.session;
    renderSessionState(message.session);
    setCallStatus('You left the call', 'warn');
    enableCallControls(false);
    stopRecorder();
    stopBrowserRecording();
    stopLocalTracks();
    showToast('You left the session. The agent room is still active.');
    return;
  }
  if (message.type === 'session:ended') {
    state.session = message.session;
    renderSessionState(message.session);
    setCallStatus('Ended', 'danger');
    enableCallControls(false);
    stopRecorder();
    stopBrowserRecording();
    stopLocalTracks();
    showToast('Session ended cleanly.');
  }
}

function startRecorder() {
  if (!state.localStream || state.mediaRecorder) return;
  const mimeType = pickMimeType();
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    showToast('This browser cannot stream WebM media for relay.');
    return;
  }
  const recorder = new MediaRecorder(state.localStream, {
    mimeType,
    videoBitsPerSecond: 750000,
    audioBitsPerSecond: 64000
  });
  state.mediaRecorder = recorder;
  recorder.addEventListener('dataavailable', async (event) => {
    if (!event.data.size || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    const data = await blobToBase64(event.data);
    sendWs({
      type: 'media:chunk',
      seq: ++state.mediaSeq,
      mimeType,
      data
    });
  });
  recorder.addEventListener('stop', () => {
    state.mediaRecorder = null;
  });
  sendWs({ type: 'media:start', mimeType });
  recorder.start(350);
}

function stopRecorder() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
}

function syncBrowserRecording(recording) {
  if (state.role !== 'agent') return;
  if (recording?.status === 'in_progress') {
    startBrowserRecording().catch(() => {});
    return;
  }
  if (state.browserRecording.recorder) {
    stopBrowserRecording();
  }
}

async function startBrowserRecording() {
  if (state.browserRecording.recorder || !state.localStream) return;

  const remoteVideo = document.querySelector('#remote-video');
  const localVideo = document.querySelector('#local-video');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d');
  const drawFrame = () => {
    context.fillStyle = '#10211d';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (remoteVideo && remoteVideo.readyState >= 2) {
      context.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);
    }

    if (localVideo && localVideo.readyState >= 2) {
      const insetWidth = 280;
      const insetHeight = 158;
      const x = canvas.width - insetWidth - 28;
      const y = canvas.height - insetHeight - 28;
      context.fillStyle = 'rgba(12, 23, 21, 0.9)';
      context.fillRect(x - 6, y - 6, insetWidth + 12, insetHeight + 12);
      context.drawImage(localVideo, x, y, insetWidth, insetHeight);
    }

    state.browserRecording.animationFrame = requestAnimationFrame(drawFrame);
  };
  drawFrame();

  const canvasStream = canvas.captureStream(24);
  let mixedAudioTrack = null;
  let audioContext = null;

  try {
    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    if (state.localStream.getAudioTracks().length) {
      const localSource = audioContext.createMediaStreamSource(state.localStream);
      localSource.connect(destination);
    }

    if (remoteVideo?.captureStream) {
      const remoteStream = remoteVideo.captureStream();
      if (remoteStream.getAudioTracks().length) {
        const remoteSource = audioContext.createMediaStreamSource(remoteStream);
        remoteSource.connect(destination);
      }
    }

    mixedAudioTrack = destination.stream.getAudioTracks()[0] || null;
  } catch (_) {
    mixedAudioTrack = null;
  }

  const combinedTracks = [...canvasStream.getVideoTracks()];
  if (mixedAudioTrack) combinedTracks.push(mixedAudioTrack);
  const combinedStream = new MediaStream(combinedTracks);
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 1800000,
    audioBitsPerSecond: 96000
  });

  state.browserRecording = {
    recorder,
    chunks: [],
    blobUrl: '',
    filename: '',
    stream: combinedStream,
    animationFrame: state.browserRecording.animationFrame,
    canvas,
    audioContext
  };

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size) {
      state.browserRecording.chunks.push(event.data);
    }
  });

  recorder.addEventListener('stop', () => {
    const chunks = state.browserRecording.chunks;
    if (chunks.length) {
      const blob = new Blob(chunks, { type: mimeType });
      if (state.browserRecording.blobUrl) {
        URL.revokeObjectURL(state.browserRecording.blobUrl);
      }
      state.browserRecording.blobUrl = URL.createObjectURL(blob);
      state.browserRecording.filename = `atomlens-${state.session?.id || 'session'}-${Date.now()}.webm`;
    }
    cleanupBrowserRecordingResources({ keepDownload: true });
    renderSessionSummaryCard(state.session);
  });

  recorder.start(500);
}

function stopBrowserRecording() {
  const recorder = state.browserRecording.recorder;
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
    return;
  }
  cleanupBrowserRecordingResources({ keepDownload: true });
}

function cleanupBrowserRecordingResources(options = {}) {
  if (state.browserRecording.animationFrame) {
    cancelAnimationFrame(state.browserRecording.animationFrame);
  }
  if (state.browserRecording.stream) {
    state.browserRecording.stream.getTracks().forEach((track) => track.stop());
  }
  if (state.browserRecording.audioContext) {
    state.browserRecording.audioContext.close().catch(() => {});
  }
  state.browserRecording.recorder = null;
  state.browserRecording.stream = null;
  state.browserRecording.animationFrame = 0;
  state.browserRecording.canvas = null;
  state.browserRecording.audioContext = null;
  state.browserRecording.chunks = [];
  if (!options.keepDownload && state.browserRecording.blobUrl) {
    URL.revokeObjectURL(state.browserRecording.blobUrl);
    state.browserRecording.blobUrl = '';
    state.browserRecording.filename = '';
  }
}

function stopLocalTracks() {
  if (!state.localStream) return;
  state.localStream.getTracks().forEach((track) => track.stop());
  state.localStream = null;
}

function setupRemoteMedia(mimeType) {
  const video = document.querySelector('#remote-video');
  if (!window.MediaSource) {
    showToast('Remote streaming requires MediaSource support.');
    return;
  }
  if (state.remote.objectUrl) URL.revokeObjectURL(state.remote.objectUrl);
  state.remote = {
    mediaSource: new MediaSource(),
    sourceBuffer: null,
    queue: [],
    objectUrl: null,
    mimeType
  };
  state.remote.objectUrl = URL.createObjectURL(state.remote.mediaSource);
  video.src = state.remote.objectUrl;
  state.remote.mediaSource.addEventListener('sourceopen', () => {
    const supported = MediaSource.isTypeSupported(mimeType) ? mimeType : 'video/webm;codecs=vp8,opus';
    try {
      state.remote.sourceBuffer = state.remote.mediaSource.addSourceBuffer(supported);
      state.remote.sourceBuffer.mode = 'sequence';
      state.remote.sourceBuffer.addEventListener('updateend', drainRemoteQueue);
      drainRemoteQueue();
    } catch (error) {
      showToast('Could not prepare remote media buffer.');
    }
  }, { once: true });
}

function appendRemoteChunk(base64, mimeType) {
  if (!state.remote.mediaSource) setupRemoteMedia(mimeType || 'video/webm;codecs=vp8,opus');
  state.remote.queue.push(base64ToBytes(base64));
  drainRemoteQueue();
}

function drainRemoteQueue() {
  const remote = state.remote;
  const video = document.querySelector('#remote-video');
  if (!remote.sourceBuffer || remote.sourceBuffer.updating || !remote.queue.length) return;
  try {
    remote.sourceBuffer.appendBuffer(remote.queue.shift());
    if (video.paused) video.play().catch(() => {});
  } catch (error) {
    remote.queue = [];
  }
}

function toggleAudio() {
  state.audioMuted = !state.audioMuted;
  for (const track of state.localStream?.getAudioTracks() || []) {
    track.enabled = !state.audioMuted;
  }
  document.querySelector('#mute-audio').textContent = state.audioMuted ? 'Unmute Audio' : 'Mute Audio';
  updateLocalFlags();
  sendTrackState();
}

function toggleVideo() {
  state.videoOff = !state.videoOff;
  for (const track of state.localStream?.getVideoTracks() || []) {
    track.enabled = !state.videoOff;
  }
  document.querySelector('#toggle-video').textContent = state.videoOff ? 'Turn Video On' : 'Turn Video Off';
  updateLocalFlags();
  sendTrackState();
}

function sendTrackState() {
  sendWs({
    type: 'track:update',
    audioMuted: state.audioMuted,
    videoOff: state.videoOff
  });
}

function updateLocalFlags() {
  const flags = [];
  if (state.audioMuted) flags.push('mic muted');
  if (state.videoOff) flags.push('camera off');
  document.querySelector('#local-flags').textContent = flags.join(' • ');
}

function updateRemoteFlags(message) {
  const flags = [];
  if (message.audioMuted) flags.push('mic muted');
  if (message.videoOff) flags.push('camera off');
  document.querySelector('#remote-flags').textContent = flags.join(' • ');
}

function sendChat(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const text = form.elements.text.value.trim();
  if (!text) return;
  sendWs({ type: 'chat:send', text });
  form.reset();
}

async function sendFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('File limit is 5 MB.');
    event.target.value = '';
    return;
  }
  const data = await blobToBase64(file);
  sendWs({
    type: 'file:upload',
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    data
  });
  event.target.value = '';
}

function renderSessionState(session) {
  document.querySelector('#session-summary').textContent =
    `${roleLabel(state.role || 'agent')} view. Agent: ${session.participants.agent.name}. Customer: ${session.participants.customer.name}.`;
  renderMessages(session.messages || []);
  renderTimeline(session.events || []);
  renderRecording(session.recording);
  renderSessionSummaryCard(session);
  const status = session.status === 'ended' ? 'Ended' : session.status === 'active' ? 'Active' : 'Waiting';
  setCallStatus(status, session.status === 'ended' ? 'danger' : session.status === 'active' ? 'ok' : 'warn');
}

function renderSessionSummaryCard(session) {
  const host = document.querySelector('#session-summary-card');
  if (!host) return;
  const agent = session.participants.agent;
  const customer = session.participants.customer;
  const recording = session.recording;
  const download = getRecordingDownloadInfo(recording);
  host.innerHTML = `
    <section class="panel summary-card">
      <div class="panel-head">
        <span class="eyebrow">${session.status === 'ended' ? 'Session complete' : 'Session overview'}</span>
        <h2 class="section-title">${session.status === 'ended' ? 'Call summary and recording' : 'Live session details'}</h2>
      </div>
      <div class="status-grid">
        ${metric('Agent time', formatDuration(agent.totalMs))}
        ${metric('Customer time', formatDuration(customer.totalMs))}
        ${metric('Messages', session.messages?.length || 0)}
        ${metric('Files', session.files?.length || 0)}
      </div>
      ${recording ? `
        <div class="recording-panel ${escapeAttr(recording.status)}">
          <div>
            <strong>Recording status</strong>
            <p>${escapeHtml(recordingStatusText(recording, session.status))}</p>
          </div>
          ${download.url ? `<a class="button-link" href="${escapeAttr(download.url)}" ${download.download ? `download="${escapeAttr(download.download)}"` : ''}>${escapeHtml(download.label)}</a>` : ''}
        </div>
      ` : `
        <div class="empty">No recording has been started for this session yet.</div>
      `}
    </section>
  `;
}

function renderMessages(messages) {
  const list = document.querySelector('#messages');
  if (!list) return;
  if (!messages.length) {
    list.innerHTML = '<div class="empty">No messages yet.</div>';
    return;
  }
  list.innerHTML = messages.map((message) => `
    <article class="message">
      <header>
        <span>${escapeHtml(message.name || roleLabel(message.role))}</span>
        <time>${formatTime(message.at)}</time>
      </header>
      ${message.type === 'file'
        ? `<p><a href="${escapeAttr(withSessionToken(message.file.url))}" target="_blank" rel="noreferrer">${escapeHtml(message.file.name)}</a> <span class="subtle">(${formatBytes(message.file.size)})</span></p>`
        : `<p>${escapeHtml(message.text)}</p>`}
    </article>
  `).join('');
  list.scrollTop = list.scrollHeight;
}

function renderTimeline(events) {
  const timeline = document.querySelector('#timeline');
  if (!timeline) return;
  if (!events.length) {
    timeline.innerHTML = '<div class="empty">No events yet.</div>';
    return;
  }
  timeline.innerHTML = events.slice().reverse().map((event) => `
    <div class="timeline-item">
      <strong>${escapeHtml(event.detail)}</strong>
      <small>${escapeHtml(event.type)} - ${formatTime(event.at)}</small>
    </div>
  `).join('');
}

function renderRecording(recording) {
  const status = document.querySelector('#recording-status');
  const button = document.querySelector('#record-toggle');
  if (!status) return;
  if (!recording) {
    status.textContent = 'Recording idle';
    status.className = 'badge';
    if (button) button.textContent = 'Start Recording';
    return;
  }
  status.textContent = recordingStatusLabel(recording);
  status.className = `badge ${recording.status === 'ready' ? 'ok' : recording.status === 'failed' ? 'danger' : 'warn'}`;
  if (button) {
    button.textContent = recording.status === 'in_progress' ? 'Stop Recording' : 'Start Recording';
    button.disabled = recording.status === 'processing' || state.session?.status === 'ended';
  }
}

function enableCallControls(enabled) {
  for (const id of ['mute-audio', 'toggle-video', 'end-call', 'send-chat']) {
    const element = document.querySelector(`#${id}`);
    if (element) element.disabled = !enabled;
  }
  const record = document.querySelector('#record-toggle');
  if (record) record.disabled = !enabled || state.session?.status === 'ended';
  const join = document.querySelector('#join-call');
  join.disabled = enabled;
  join.textContent = enabled ? 'Connected' : 'Join Call';
}

async function renderAdmin() {
  const savedKey = localStorage.getItem('atomlens-admin-key') || state.accessInfo?.adminKey || 'demo-admin-key';
  app.innerHTML = `
    <section class="panel">
      <span class="eyebrow">Operations</span>
      <h1 class="section-title">Admin dashboard</h1>
      <form id="admin-key-form" class="form-stack">
        <label>
          Admin key
          <input name="key" value="${escapeAttr(savedKey)}">
        </label>
        <div class="actions">
          <button type="submit">Load Dashboard</button>
          <a class="button-link secondary-link" href="/metrics" target="_blank" rel="noreferrer">Open Metrics</a>
        </div>
      </form>
    </section>
    <section id="admin-content" class="admin-list" style="margin-top: 1rem;"></section>
  `;
  document.querySelector('#admin-key-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const key = new FormData(event.currentTarget).get('key');
    localStorage.setItem('atomlens-admin-key', key);
    await loadAdmin(key);
  });
  await loadAdmin(savedKey);
  setInterval(() => {
    if (params.has('admin')) loadAdmin(localStorage.getItem('atomlens-admin-key') || savedKey);
  }, 4000);
}

async function loadAdmin(key) {
  const target = document.querySelector('#admin-content');
  try {
    const data = await api('/api/admin/sessions', { headers: { 'x-admin-key': key } });
    target.innerHTML = `
      <div class="status-grid">
        ${metric('Active sessions', data.metrics.activeSessions)}
        ${metric('Connected participants', data.metrics.connectedParticipants)}
        ${metric('Total sessions', data.metrics.totalSessions)}
        ${metric('Chat messages', data.metrics.totalMessages)}
      </div>
      ${data.sessions.length ? data.sessions.map((session) => adminSessionCard(session)).join('') : '<div class="empty">No sessions yet.</div>'}
    `;
    target.querySelectorAll('[data-admin-end]').forEach((button) => {
      button.addEventListener('click', async () => {
        await api(`/api/admin/sessions/${button.dataset.adminEnd}/end`, {
          method: 'POST',
          headers: { 'x-admin-key': key },
          body: {}
        });
        await loadAdmin(key);
      });
    });
  } catch (error) {
    target.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function adminSessionCard(session) {
  const agent = session.participants.agent;
  const customer = session.participants.customer;
  return `
    <article class="session-card">
      <header>
        <div>
          <span class="badge ${session.status === 'ended' ? 'danger' : session.status === 'active' ? 'ok' : 'warn'}">${escapeHtml(session.status)}</span>
          <h2>${escapeHtml(session.id)}</h2>
        </div>
        ${session.status !== 'ended' ? `<button class="danger" data-admin-end="${escapeAttr(session.id)}">End Session</button>` : ''}
      </header>
      <div class="kv">
        <div><span>Agent</span>${escapeHtml(agent.name)} - ${agent.connected ? 'connected' : 'offline'} - ${formatDuration(agent.totalMs)}</div>
        <div><span>Customer</span>${escapeHtml(customer.name)} - ${customer.connected ? 'connected' : 'offline'} - ${formatDuration(customer.totalMs)}</div>
        <div><span>Messages</span>${session.messages?.length || 0}</div>
        <div><span>Recording</span>${session.recording ? escapeHtml(session.recording.status) : 'none'}</div>
      </div>
      <div class="timeline">
        ${(session.events || []).slice(-4).reverse().map((event) => `
          <div class="timeline-item">
            <strong>${escapeHtml(event.detail)}</strong>
            <small>${formatTime(event.at)}</small>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function sendWs(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    showToast('Call is not connected yet.');
    return;
  }
  state.ws.send(JSON.stringify(payload));
}

async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(state.auth?.token ? { authorization: `Bearer ${state.auth.token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    if (response.status === 401 && data.error === 'agent_login_required') {
      state.auth = null;
      localStorage.removeItem(AUTH_STORAGE_KEY);
      renderAgentLogin();
    }
    throw new Error(data.message || data.error || `Request failed with ${response.status}`);
  }
  return data;
}

async function fetchAccessInfo() {
  try {
    const response = await fetch('/api/access-info');
    if (!response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  }
}

function metric(label, value) {
  return `<div class="metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function storyItem(title, body) {
  return `
    <div class="story-item">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </div>
  `;
}

function copyField(label, value) {
  return `
    <label>
      ${escapeHtml(label)}
      <div class="copy-row">
        <input readonly value="${escapeAttr(value)}">
        <button type="button" class="secondary" data-copy="${escapeAttr(value)}">Copy</button>
      </div>
    </label>
  `;
}

function bindCopyButtons(root = document) {
  root.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast('Copied to clipboard.');
    });
  });
}

function setCallStatus(text, tone) {
  const status = document.querySelector('#call-status');
  if (!status) return;
  status.textContent = text;
  status.className = `badge ${tone || ''}`;
}

function getRecordingDownloadInfo(recording) {
  if (state.role !== 'agent') return { url: '', download: '', label: '' };
  if (state.browserRecording.blobUrl) {
    return {
      url: state.browserRecording.blobUrl,
      download: state.browserRecording.filename || 'atomlens-recording.webm',
      label: 'Download Recording'
    };
  }
  if (!recording || recording.status !== 'ready') return { url: '', download: '', label: '' };
  return {
    url: `/api/recordings/${state.session.id}/${recording.id}/download?token=${encodeURIComponent(state.token)}`,
    download: '',
    label: 'Download Server Archive'
  };
}

function recordingStatusLabel(recording) {
  if (!recording) return 'Recording idle';
  if (recording.status === 'in_progress') return 'Recording live';
  if (recording.status === 'processing') return 'Recording processing';
  if (recording.status === 'ready') return 'Recording ready';
  return 'Recording failed';
}

function recordingStatusText(recording, sessionStatus) {
  if (!recording) return 'Recording has not been started.';
  if (recording.status === 'ready') {
    if (state.browserRecording.blobUrl) {
      return sessionStatus === 'ended'
        ? 'The recorded WebM file is ready and can be downloaded now.'
        : 'The recorded WebM file is ready for download.';
    }
    return sessionStatus === 'ended'
      ? 'The server archive is ready and can be downloaded now.'
      : 'The server archive is ready for download.';
  }
  if (recording.status === 'processing') return 'The recording is being finalized by the server.';
  if (recording.status === 'in_progress') return 'Recording is still running during the live session.';
  return recording.error || 'Recording could not be prepared.';
}

function hydrateMessage(message) {
  if (!message || message.type !== 'file') return message;
  return {
    ...message,
    file: {
      ...message.file,
      url: withSessionToken(message.file.url)
    }
  };
}

function withSessionToken(url) {
  if (!url || !state.token || url.includes('token=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(state.token)}`;
}

function getClientId(sessionId, role) {
  const key = `atomlens-client-${sessionId}-${role}`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function roleLabel(role) {
  return role === 'agent' ? 'Agent' : 'Customer';
}

function pickMimeType() {
  const choices = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm'
  ];
  return choices.find((mime) => MediaRecorder.isTypeSupported(mime)) || 'video/webm';
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatTime(value) {
  if (!value) return 'never';
  return new Date(value).toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    month: 'short',
    day: 'numeric'
  });
}

function formatDuration(ms = 0) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}
