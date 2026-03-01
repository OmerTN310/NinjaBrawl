/* ============================================================
   leaderboard.js — Weekly Leaderboard
   Phase 2: יסונכרן לשרת
   ============================================================ */

const Leaderboard = (() => {

  const WEEK_MS  = 7 * 24 * 60 * 60 * 1000;
  const MAX_ROWS = 10;
  const PRIZE_TN = 500;

  // ── Week Key ─────────────────────────────────────────────
  function getWeekKey() {
    return 'ninjabrawl_lb_' + Math.floor(Date.now() / WEEK_MS);
  }

  function getPrevWeekKey() {
    return 'ninjabrawl_lb_' + (Math.floor(Date.now() / WEEK_MS) - 1);
  }

  // ── Read / Write ─────────────────────────────────────────
  function getEntries() {
    try {
      return JSON.parse(localStorage.getItem(getWeekKey()) || '[]');
    } catch { return []; }
  }

  function saveEntries(entries) {
    try {
      localStorage.setItem(getWeekKey(), JSON.stringify(entries));
    } catch(e) { console.warn('LB save failed', e); }
  }

  // ── Submit Score ─────────────────────────────────────────
  function submit(score, stats = {}) {
    const profile = typeof PlayerProfile !== 'undefined' ? PlayerProfile.get() : null;
    const addr    = window._walletAddr
                 || localStorage.getItem('ninja_wallet')
                 || 'Guest_' + Math.random().toString(36).slice(2, 6);

    // Use profile name if available, otherwise wallet short name
    let shortName;
    if (profile && profile.name && profile.name !== 'NinjaPlayer') {
      shortName = profile.name;
    } else if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
      shortName = FirebaseAuth.getDisplayName() || 'Ninja';
    } else {
      shortName = addr.startsWith('0x')
        ? addr.slice(0, 6) + '..' + addr.slice(-4)
        : addr;
    }

    // ── Save to localStorage (instant) ──
    const entries  = getEntries();
    const existing = entries.findIndex(e => e.addr === addr);

    if (existing >= 0) {
      if (score > entries[existing].score) {
        entries[existing] = {
          addr, name: shortName,
          score, stats,
          time: Date.now(),
        };
      }
    } else {
      entries.push({
        addr, name: shortName,
        score, stats,
        time: Date.now(),
      });
    }

    entries.sort((a, b) => b.score - a.score);
    const top = entries.slice(0, MAX_ROWS);
    saveEntries(top);

    const rank = top.findIndex(e => e.addr === addr) + 1;

    // ── Also submit to Firebase (async, only if signed in) ──
    if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
      FirebaseAuth.submitScore(score, stats).catch(e =>
        console.warn('[LB] Firebase submit failed:', e)
      );
    }

    return { rank, entries: top };
  }

  // ── Get My Rank ──────────────────────────────────────────
  function getMyRank() {
    const addr = window._walletAddr
              || localStorage.getItem('ninja_wallet');
    if (!addr) return null;

    const entries = getEntries();
    const idx     = entries.findIndex(e => e.addr === addr);
    return idx >= 0 ? { rank: idx + 1, entry: entries[idx] } : null;
  }

  // ── Time Until Reset ─────────────────────────────────────
  function getTimeUntilReset() {
    const nextWeek = (Math.floor(Date.now() / WEEK_MS) + 1) * WEEK_MS;
    const diff     = nextWeek - Date.now();
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const s = Math.floor((diff % 60000)    / 1000);
    return { diff, d, h, m, s, label: `${d}d ${h}h ${m}m` };
  }

  // ── Render: Compact (menu preview) ───────────────────────
  function renderCompact(containerId, maxRows = 5) {
    const el = document.getElementById(containerId);
    if (!el) return;

    // Only show registered users (Firebase only)
    if (typeof FirebaseAuth !== 'undefined') {
      FirebaseAuth.fetchLeaderboard(maxRows).then(fbEntries => {
        renderCompactHTML(el, (fbEntries || []).slice(0, maxRows));
      }).catch(() => {
        renderCompactHTML(el, []);
      });
    } else {
      renderCompactHTML(el, []);
    }
  }

  function renderCompactHTML(el, entries) {
    const medals  = ['🥇', '🥈', '🥉'];

    if (entries.length === 0) {
      el.innerHTML = `
        <div style="
          color: rgba(255,255,255,0.2);
          font-size: 0.62rem;
          text-align: center;
          padding: 12px 0;
          letter-spacing: 2px;
          font-family: sans-serif;
        ">
          ${I18n.t('sign_in_lb')} 🥷
        </div>`;
      return;
    }

    el.innerHTML = entries.map((e, i) => `
      <div class="lb-row">
        <div class="lb-rank">${medals[i] || (i + 1)}</div>
        <div class="lb-name">${e.displayName || e.name || 'Ninja'}</div>
        <div class="lb-score">${e.score.toLocaleString()}</div>
      </div>
    `).join('');
  }

  // ── Render: Full Page (leaderboard.html) ─────────────────
  function renderPage() {
    // Only show registered users (Firebase only)
    if (typeof FirebaseAuth !== 'undefined') {
      FirebaseAuth.fetchLeaderboard(10).then(fbEntries => {
        renderPageHTML(fbEntries || []);
      }).catch(() => renderPageHTML([]));
    } else {
      renderPageHTML([]);
    }
  }

  function renderPageHTML(entries) {
    const myUid  = typeof FirebaseAuth !== 'undefined' && FirebaseAuth.getUser()
                 ? FirebaseAuth.getUser().uid : null;
    const myAddr = window._walletAddr
                || localStorage.getItem('ninja_wallet');

    // ── Week timer ─────────────────────────────────────────
    const timerEl = document.getElementById('weekTimer');
    const updateTimer = () => {
      if (!timerEl) return;
      const { label } = getTimeUntilReset();
      timerEl.textContent = `⏳ ${I18n.t('resets_in')} ${label}`;
    };
    updateTimer();
    setInterval(updateTimer, 60000);

    // ── Podium (top 3) ────────────────────────────────────
    const podiumEl = document.getElementById('podium');
    if (podiumEl && entries.length > 0) {
      // Visual order: 2nd | 1st | 3rd
      const slots = [
        { idx: 1, cls: 'second', medal: '🥈' },
        { idx: 0, cls: 'first',  medal: '🥇' },
        { idx: 2, cls: 'third',  medal: '🥉' },
      ];

      podiumEl.innerHTML = slots.map(({ idx, cls, medal }) => {
        const e = entries[idx];
        if (!e) return `<div class="podium-slot"><div class="podium-bar ${cls}"></div></div>`;
        return `
          <div class="podium-slot">
            <div class="podium-medal">${medal}</div>
            <div class="podium-name">${e.displayName || e.name || 'Ninja'}</div>
            <div class="podium-score">${e.score.toLocaleString()}</div>
            <div class="podium-bar ${cls}"></div>
          </div>
        `;
      }).join('');
    }

    // ── Full list ─────────────────────────────────────────
    const listEl = document.getElementById('leaderboardList');
    if (listEl) {
      if (entries.length === 0) {
        listEl.innerHTML = `
          <div style="
            color: rgba(255,255,255,0.2);
            font-size: 0.7rem;
            text-align: center;
            padding: 30px 0;
            letter-spacing: 3px;
          ">${I18n.t('no_entries')}</div>`;
      } else {
        const medals = ['🥇', '🥈', '🥉'];
        listEl.innerHTML = entries.map((e, i) => {
          const isMe = (myUid && e.uid === myUid) || (e.addr && e.addr === myAddr);
          return `
            <div class="lb-row ${isMe ? 'me' : ''}">
              <div class="lb-rank">${medals[i] || (i + 1)}</div>
              <div class="lb-name">
                ${e.displayName || e.name || 'Ninja'}
                ${isMe ? `<span style="color:var(--ninja);font-size:0.5rem;margin-left:6px">← ${I18n.t('you_marker')}</span>` : ''}
              </div>
              <div class="lb-score">${e.score.toLocaleString()}</div>
            </div>
          `;
        }).join('');
      }
    }

    // ── My rank box ───────────────────────────────────────
    const myRank   = getMyRank();
    const myRankEl = document.getElementById('myRank');
    if (myRankEl && myRank) {
      myRankEl.classList.remove('hidden');
      document.getElementById('myRankData').innerHTML = `
        <span style="color:var(--gold);font-size:1.6rem;font-weight:900">
          #${myRank.rank}
        </span>
        <span style="color:rgba(255,255,255,0.4);font-size:0.7rem;margin-left:10px">
          ${myRank.entry.score.toLocaleString()} pts
        </span>
      `;
    }

  }

  // ── Get Previous Week Winner ──────────────────────────────
  function getLastWeekWinner() {
    try {
      const prev = JSON.parse(
        localStorage.getItem(getPrevWeekKey()) || '[]'
      );
      return prev[0] || null;
    } catch { return null; }
  }

  // ── Add test data (dev only) ──────────────────────────────
  function seedTestData() {
    const fake = [
      { addr: '0xABCD', name: '0xABCD..1234', score: 1840, stats: {}, time: Date.now() },
      { addr: '0xDEF0', name: '0xDEF0..5678', score: 1420, stats: {}, time: Date.now() },
      { addr: '0x1111', name: '0x1111..9012', score: 980,  stats: {}, time: Date.now() },
      { addr: '0x2222', name: '0x2222..3456', score: 760,  stats: {}, time: Date.now() },
      { addr: '0x3333', name: '0x3333..7890', score: 540,  stats: {}, time: Date.now() },
    ];
    saveEntries(fake);
  }

  // ── Public API ────────────────────────────────────────────
  return {
    submit,
    getEntries,
    getMyRank,
    getTimeUntilReset,
    renderCompact,
    renderPage,
    getLastWeekWinner,
    seedTestData,
    PRIZE_TN,
  };

})();