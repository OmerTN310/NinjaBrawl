/* ============================================================
   server.js — Ninja Brawl Backend (Phase 2)
   WebSockets (ws) + Express
   Deploy on: Railway / Render (free tier)
   ============================================================ */

require('dotenv').config();
const express = require('express');
const path    = require('path');
const { WebSocketServer } = require('ws');
const http    = require('http');
const cors    = require('cors');
const { GameRoom } = require('./gameRoom');

const PORT = process.env.PORT || 3000;

// ── HTTP Server ───────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Serve game files (so other devices on the network can access)
app.use(express.static(path.join(__dirname, '..')));

// ── REST: Get Leaderboard (Phase 2) ─────────────────────────
// TODO: Hook into DB (PostgreSQL / SQLite)
const weeklyLB = [];

app.get('/leaderboard', (req, res) => {
  res.json(weeklyLB.sort((a, b) => b.score - a.score).slice(0, 10));
});

app.post('/score', (req, res) => {
  const { wallet, score } = req.body;
  if (!wallet || typeof score !== 'number') return res.status(400).json({ error: 'Invalid' });
  // TODO: Verify score is realistic (anti-cheat)
  const existing = weeklyLB.find(e => e.wallet === wallet);
  if (existing) { if (score > existing.score) existing.score = score; }
  else           { weeklyLB.push({ wallet, score, time: Date.now() }); }
  res.json({ rank: weeklyLB.sort((a,b) => b.score - a.score).findIndex(e => e.wallet === wallet) + 1 });
});

// ── WebSocket Server ──────────────────────────────────────────
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// Room management
const rooms   = new Map(); // roomId → GameRoom
const waiting = [];        // sockets waiting for match

// ── Ping/Pong keepalive ─────────────────────────────────────
const PING_INTERVAL = 15000; // 15s
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[WS] Terminating dead connection:', ws.id);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

wss.on('connection', (ws) => {
  console.log('[WS] New connection');
  ws.id      = Math.random().toString(36).slice(2);
  ws.wallet  = null;
  ws.roomId  = null;
  ws.isAlive = true;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    console.log('[WS] Disconnected:', ws.id);
    // Remove from waiting queue
    const idx = waiting.indexOf(ws);
    if (idx >= 0) waiting.splice(idx, 1);
    // Notify room partner
    if (ws.roomId && rooms.has(ws.roomId)) {
      const room = rooms.get(ws.roomId);
      room.onPlayerLeft(ws.id);
      rooms.delete(ws.roomId);
    }
  });
});

// ── Message Handler ──────────────────────────────────────────
function handleMessage(ws, msg) {
  switch (msg.type) {

    case 'join':
      ws.wallet = msg.data?.wallet || 'anonymous';
      ws.uid    = msg.data?.uid    || null;
      ws.name   = msg.data?.name   || 'Ninja';
      console.log('[WS] Join:', ws.wallet, ws.name);
      // Matchmaking
      matchmake(ws);
      break;

    case 'gameState':
      // Forward player state to opponent
      if (ws.roomId && rooms.has(ws.roomId)) {
        rooms.get(ws.roomId).relay(ws.id, { type: 'enemyState', data: msg.data });
      }
      break;

    case 'shoot':
      if (ws.roomId && rooms.has(ws.roomId)) {
        rooms.get(ws.roomId).relay(ws.id, { type: 'enemyShoot', data: msg.data });
      }
      break;

    case 'submitScore':
      // Record score
      const { wallet, score } = msg.data || {};
      if (wallet && score >= 0) {
        const existing = weeklyLB.find(e => e.wallet === wallet);
        if (existing) { if (score > existing.score) existing.score = score; }
        else           { weeklyLB.push({ wallet, score, time: Date.now() }); }
        const rank = weeklyLB.sort((a,b) => b.score - a.score).findIndex(e => e.wallet === wallet) + 1;
        send(ws, { type: 'scoreConfirmed', data: { rank } });
      }
      break;

    default:
      console.warn('[WS] Unknown message type:', msg.type);
  }
}

// ── Anti-self-match check ─────────────────────────────────────
function isSamePlayer(a, b) {
  // Same Firebase UID
  if (a.uid && b.uid && a.uid === b.uid) return true;
  // Same wallet address (non-anonymous)
  if (a.wallet && b.wallet && a.wallet !== 'anonymous' && a.wallet === b.wallet) return true;
  return false;
}

// ── Matchmaking ──────────────────────────────────────────────
function matchmake(ws) {
  // Clean stale sockets from waiting queue
  for (let i = waiting.length - 1; i >= 0; i--) {
    if (waiting[i].readyState !== 1) {
      console.log('[Match] Removing stale socket from queue');
      waiting.splice(i, 1);
    }
  }

  // Find a valid opponent (not the same player)
  let opponentIdx = -1;
  for (let i = 0; i < waiting.length; i++) {
    if (!isSamePlayer(ws, waiting[i])) {
      opponentIdx = i;
      break;
    }
  }

  if (opponentIdx >= 0) {
    const opponent = waiting.splice(opponentIdx, 1)[0];
    const roomId   = `room_${Date.now()}`;
    ws.roomId       = roomId;
    opponent.roomId = roomId;
    const room = new GameRoom(roomId, ws, opponent);
    rooms.set(roomId, room);
    // Notify both players
    send(ws,       { type: 'matched', data: { roomId, playerId: 'p1', opponentName: opponent.name } });
    send(opponent, { type: 'matched', data: { roomId, playerId: 'p2', opponentName: ws.name } });
    console.log('[Match] Room created:', roomId);
  } else {
    waiting.push(ws);
    send(ws, { type: 'waiting', data: { message: 'Searching for opponent...' } });
    console.log('[Match] Player added to queue. Waiting:', waiting.length);
  }
}

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

// ── Start ────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🥷 Ninja Brawl Server running on port ${PORT}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  // Find local IP from any network interface
  const nets = require('os').networkInterfaces();
  let localIp = '0.0.0.0';
  for (const name of Object.keys(nets)) {
    const iface = nets[name].find(i => i.family === 'IPv4' && !i.internal);
    if (iface) { localIp = iface.address; break; }
  }
  console.log(`🌐 Network: http://${localIp}:${PORT}`);
});
