/* ============================================================
   gameRoom.js — Manages a single 1v1 match
   ============================================================ */

class GameRoom {
  constructor(id, p1, p2) {
    this.id      = id;
    this.players = { [p1.id]: p1, [p2.id]: p2 };
    this.started = false;
    this.scores  = {};
    console.log(`[Room ${id}] Created with players:`, p1.id, p2.id);
    this.start();
  }

  start() {
    this.started = true;
    // Both players are now matched — game starts client-side
  }

  // Relay message from one player to the other
  relay(senderId, message) {
    for (const [id, ws] of Object.entries(this.players)) {
      if (id !== senderId && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  // Broadcast to all players in room
  broadcast(message) {
    for (const ws of Object.values(this.players)) {
      if (ws.readyState === 1) ws.send(JSON.stringify(message));
    }
  }

  onPlayerLeft(playerId) {
    console.log(`[Room ${this.id}] Player left:`, playerId);
    // Notify remaining player
    this.relay(playerId, { type: 'opponentLeft', data: {} });
  }

  submitScore(playerId, score) {
    this.scores[playerId] = score;
    // If both submitted, determine winner
    if (Object.keys(this.scores).length === 2) {
      const [p1id, p2id] = Object.keys(this.players);
      const winner = this.scores[p1id] >= this.scores[p2id] ? p1id : p2id;
      this.broadcast({
        type: 'gameResult',
        data: { winner, scores: this.scores }
      });
      // TODO Phase 3: Trigger TN reward transfer via contract
    }
  }
}

module.exports = { GameRoom };
