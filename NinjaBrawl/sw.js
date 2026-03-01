/* ============================================================
   sw.js — Service Worker | Ninja Brawl PWA
   ============================================================
   - Cache-first for static assets (JS, CSS, HTML)
   - Network-first for navigation requests
   - Skips WebSocket, blockchain RPC & external API calls
   - Auto-cleans old cache versions on activate
   ============================================================ */

const CACHE_VERSION = 11;
const CACHE_NAME = `ninja-brawl-v${CACHE_VERSION}`;

// ── Static assets to pre-cache on install ────────────────────
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './game.html',
  './leaderboard.html',
  './manifest.json',
  './css/style.css',
  './css/game.css',
  './js/app.js',
  './js/engine.js',
  './js/ai.js',
  './js/game.js',
  './js/leaderboard.js',
  './js/socket.js',
  './js/firebase-auth.js',
  './js/web3modal.js',
];

// ── URLs that should NEVER be cached ─────────────────────────
const NO_CACHE_PATTERNS = [
  /^wss?:\/\//,                    // WebSocket connections
  /mainnet\.base\.org/,            // Base RPC calls
  /basescan\.org/,                 // Block explorer API
  /api\./,                         // Any API endpoints
  /\/socket/,                      // Socket endpoints
  /chrome-extension:\/\//,         // Browser extensions (MetaMask)
  /firebaseio\.com/,               // Firebase Realtime Database
  /reown\.com/,                    // Reown AppKit / WalletConnect
  /walletconnect\./,               // WalletConnect relay
  /cdn\.jsdelivr\.net.*appkit/,    // AppKit CDN bundle
  /googleapis\.com\/identitytoolkit/, // Firebase Auth API
  /securetoken\.googleapis\.com/,  // Firebase token refresh
];

// ── External resources to cache on first use ─────────────────
const RUNTIME_CACHE_ORIGINS = [
  'https://cdn.ethers.io',         // ethers.js library
  'https://fonts.googleapis.com',  // Google Fonts CSS
  'https://fonts.gstatic.com',     // Google Fonts files
];


// ═══════════════════════════════════════════════════════════════
// INSTALL — Pre-cache all core assets
// ═══════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing v${CACHE_VERSION}...`);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => console.log('[SW] Pre-cache complete'))
      .catch((err) => console.warn('[SW] Pre-cache failed:', err))
  );

  // Activate immediately, don't wait for old SW to finish
  self.skipWaiting();
});


// ═══════════════════════════════════════════════════════════════
// ACTIVATE — Clean up old caches
// ═══════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating v${CACHE_VERSION}...`);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('ninja-brawl-') && name !== CACHE_NAME)
          .map((old) => {
            console.log('[SW] Deleting old cache:', old);
            return caches.delete(old);
          })
      );
    })
  );

  // Take control of all open tabs immediately
  self.clients.claim();
});


// ═══════════════════════════════════════════════════════════════
// FETCH — Route requests to the right caching strategy
// ═══════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Skip non-GET requests (POST, etc.) ──
  if (request.method !== 'GET') return;

  // ── Skip URLs that should never be cached ──
  if (NO_CACHE_PATTERNS.some((pattern) => pattern.test(request.url))) return;

  // ── Navigation requests (HTML pages) → Network-first ──
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── External CDN resources (ethers, fonts) → Stale-while-revalidate ──
  if (RUNTIME_CACHE_ORIGINS.some((origin) => request.url.startsWith(origin))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ── Local static assets (JS, CSS, images) → Cache-first ──
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }
});


// ═══════════════════════════════════════════════════════════════
// CACHING STRATEGIES
// ═══════════════════════════════════════════════════════════════

/**
 * Cache-first: Return from cache, fallback to network.
 * Best for: local static assets that rarely change (JS, CSS).
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return offlineFallback(request);
  }
}

/**
 * Network-first: Try network, fallback to cache.
 * Best for: HTML navigation (always get latest version if online).
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

/**
 * Stale-while-revalidate: Return cache immediately, update in background.
 * Best for: external CDN resources (ethers.js, Google Fonts).
 */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => null);

  // Return cached version immediately if available, otherwise wait for network
  return cached || (await networkFetch) || offlineFallback(request);
}


// ═══════════════════════════════════════════════════════════════
// OFFLINE FALLBACK
// ═══════════════════════════════════════════════════════════════

/**
 * When everything fails — return the cached index or a minimal offline page.
 */
async function offlineFallback(request) {
  // If requesting a page, try to serve cached index
  if (request.destination === 'document') {
    const cachedIndex = await caches.match('./index.html');
    if (cachedIndex) return cachedIndex;
  }

  // Last resort: a minimal offline response
  return new Response(
    `<html dir="rtl" style="background:#0a0a0f;color:#00ffcc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:4rem">🥷</div>
        <h1>Ninja Brawl</h1>
        <p style="color:#aaa">אין חיבור לאינטרנט. נסה שוב מאוחר יותר.</p>
      </div>
    </html>`,
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}


// ═══════════════════════════════════════════════════════════════
// MESSAGE HANDLING — Force update from client
// ═══════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared by client request');
    });
  }
});
