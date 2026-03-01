/* ============================================================
   socket.js — WebSocket Client (Multiplayer)
   ============================================================ */

const SocketClient = (() => {

  // ── Config ───────────────────────────────────────────────
  // Auto-detect: if served via HTTP, connect to the same host
  // If opened as file://, fallback to localhost
  const SERVER_URL = 'wss://ninjabrawl.onrender.com';

  console.log('[Socket] Server URL:', SERVER_URL);

  let socket        = null;
  let connected     = false;
  let roomId        = null;
  let playerId      = null;
  let handlers      = {};
  let lastStateSent = 0;
  let reconnectTimer = null;
  let _onConnected   = null;
  const STATE_INTERVAL = 50; // ms (~20fps)
  const MAX_RECONNECT  = 5;
  let reconnectCount   = 0;

  // ── Connect ──────────────────────────────────────────────
  function connect(onConnected) {
    if (socket && socket.readyState <= 1) return;
    _onConnected = onConnected;

    console.log('[Socket] Connecting to', SERVER_URL, '...');

    try {
      socket = new WebSocket(SERVER_URL);
    } catch (e) {
      console.error('[Socket] Failed to create WebSocket:', e);
      if (handlers.error) handlers.error({ message: 'Cannot connect to server' });
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      connected = true;
      reconnectCount = 0;
      console.log('[Socket] Connected!');
      if (_onConnected) _onConnected();
    };

    socket.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      // Internal state
      if (msg.type === 'matched') {
        roomId   = msg.data.roomId;
        playerId = msg.data.playerId;
      }

      if (handlers[msg.type]) handlers[msg.type](msg.data);
    };

    socket.onclose = (event) => {
      connected = false;
      console.log('[Socket] Disconnected (code:', event.code, 'reason:', event.reason || 'none', ')');
      // Only auto-reconnect if we haven't matched yet
      if (!roomId) {
        scheduleReconnect();
      }
      if (handlers.disconnected) handlers.disconnected();
    };

    socket.onerror = (err) => {
      console.error('[Socket] Error:', err);
      if (handlers.error) handlers.error({ message: 'Connection error' });
    };
  }

  // ── Reconnect ─────────────────────────────────────────────
  function scheduleReconnect() {
    if (reconnectCount >= MAX_RECONNECT) {
      console.log('[Socket] Max reconnect attempts reached');
      if (handlers.error) handlers.error({ message: 'Cannot reach server. Make sure you access via http://localhost:3000' });
      return;
    }
    const delay = Math.min(1000 * (reconnectCount + 1), 5000);
    reconnectCount++;
    console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${reconnectCount}/${MAX_RECONNECT})...`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      socket = null;
      connect(_onConnected);
    }, delay);
  }

  // ── Disconnect ──────────────────────────────────────────
  function disconnect() {
    clearTimeout(reconnectTimer);
    if (socket) {
      socket.onclose = null;
      socket.close();
      socket    = null;
      connected = false;
      roomId    = null;
      playerId  = null;
    }
  }

  // ── Emit ─────────────────────────────────────────────────
  function emit(type, data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type, data }));
  }

  // ── On (register handler) ──────────────────────────────
  function on(type, handler) {
    handlers[type] = handler;
  }

  // ── Join Matchmaking ───────────────────────────────────
  function joinMatchmaking() {
    let name = 'Ninja';
    let uid  = null;
    if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
      name = FirebaseAuth.getDisplayName() || 'Ninja';
      uid  = FirebaseAuth.getUser().uid;
    } else if (typeof PlayerProfile !== 'undefined') {
      name = PlayerProfile.get().name || 'Ninja';
    }
    emit('join', {
      wallet: window._walletAddr || 'anonymous',
      name,
      uid,
    });
  }

  // ── Send Game State (rate-limited ~20fps) ───────────────
  function sendGameState(state) {
    const now = Date.now();
    if (now - lastStateSent < STATE_INTERVAL) return;
    lastStateSent = now;
    emit('gameState', state);
  }

  // ── Send Shoot Event ───────────────────────────────────
  function sendShoot(bulletData) {
    emit('shoot', bulletData);
  }

  // ── Send Score ──────────────────────────────────────────
  function sendScore(score) {
    emit('submitScore', { wallet: window._walletAddr || 'anonymous', score });
  }

  return {
    connect,
    disconnect,
    emit,
    on,
    joinMatchmaking,
    sendGameState,
    sendShoot,
    sendScore,
    isConnected: () => connected,
    getRoomId:   () => roomId,
    getPlayerId: () => playerId,
    getServerUrl: () => SERVER_URL,
  };
})();
