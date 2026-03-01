# 🥷 Ninja Brawl

> Top-down arena brawler powered by NinjaCoin (TN) on Base blockchain

## 🗂️ Project Structure

```
Ninja Brawl/
├── index.html          # Main menu + PWA shell
├── game.html           # Game screen
├── leaderboard.html    # Weekly leaderboard
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (offline)
│
├── css/
│   ├── style.css       # Global styles
│   └── game.css        # Game-specific styles
│
├── js/
│   ├── app.js          # Wallet + NinjaCoin connection
│   ├── engine.js       # Physics + rendering
│   ├── ai.js           # Enemy AI state machine
│   ├── leaderboard.js  # Weekly leaderboard logic
│   ├── socket.js       # WebSocket client (Phase 2)
│   └── game.js         # Main game controller
│
├── server/             # Node.js backend (Phase 2)
│   ├── server.js       # WebSocket + Express server
│   ├── gameRoom.js     # 1v1 room management
│   └── package.json
│
└── assets/
    ├── icons/          # PWA icons (192x192, 512x512)
    ├── sprites/        # Game sprites
    └── sounds/         # Sound effects
```

## 🎮 Gameplay

- **Move**: Left joystick (mobile) / WASD or Arrow keys (desktop)
- **Shoot**: 🎯 button / Space
- **Melee**: 🗡️ button / Z
- **Ultimate**: ⚡ button / X (charges automatically)

## 🏆 Weekly Leaderboard

- Each week resets on Sunday midnight UTC
- Top player receives **500 TN** (NinjaCoin) directly to their wallet
- Owner distributes via `batchTransfer` on Basescan

## 🔗 NinjaCoin Contract

- **Address**: `0x51cD66dbbd4d32a49ee6eB9a7278231a3fd40987`
- **Network**: Base (Layer 2)
- **Symbol**: TN

## 🚀 Deployment

### Frontend (Netlify)
1. Drag the root folder to [netlify.com/drop](https://app.netlify.com/drop)
2. Done! PWA is live.

### Backend — Phase 2 (Railway)
```bash
cd server
npm install
railway up
```
Update `SERVER_URL` in `js/socket.js` with your Railway URL.

## 📋 Development Phases

- ✅ **Phase 1** — Single player vs AI, local leaderboard, PWA
- 🔜 **Phase 2** — Real multiplayer (WebSockets), server leaderboard
- 🔜 **Phase 3** — Automatic TN reward distribution via smart contract
