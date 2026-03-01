/* ============================================================
   firebase-auth.js — Firebase Auth + Realtime Database
   Google Sign-in, Email/Password, Leaderboard sync
   ============================================================ */

const FirebaseAuth = (() => {

  // ── Firebase Config ─────────────────────────────────────────
  const firebaseConfig = {
    apiKey: "AIzaSyDuHOvORT0CsN-I3K3DsR2lHYDCHAEpL6g",
    authDomain: "ninjabrawl.firebaseapp.com",
    databaseURL: "https://ninjabrawl-default-rtdb.firebaseio.com",
    projectId: "ninjabrawl",
    storageBucket: "ninjabrawl.firebasestorage.app",
    messagingSenderId: "271742217070",
    appId: "1:271742217070:web:1978d4049cbaae2127af7f"
  };

  // ── Init ────────────────────────────────────────────────────
  let app, auth, db;
  let currentUser = null;

  function init() {
    if (app) return;
    app  = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db   = firebase.database();

    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
      currentUser = user;
      onAuthChange(user);
    });

    console.log('[Firebase] Initialized');
  }

  // ── Auth State Change Handler ───────────────────────────────
  function onAuthChange(user) {
    const authPanel     = document.getElementById('authPanel');
    const authUserInfo  = document.getElementById('authUserInfo');
    const authUserName  = document.getElementById('authUserName');
    const authSigninBox = document.getElementById('authSigninBox');

    if (!authPanel) return;

    if (user) {
      // Signed in
      if (authSigninBox) authSigninBox.classList.add('hidden');
      if (authUserInfo) {
        authUserInfo.classList.remove('hidden');
        if (authUserName) {
          authUserName.textContent = user.displayName || user.email || 'Ninja';
        }
      }
      // Load TN from Firebase (merge with local)
      loadTNFromDB();
      // Sync profile to DB
      syncProfileToDB();
      // Refresh leaderboard preview if on menu
      if (typeof Leaderboard !== 'undefined') {
        fetchLeaderboard().then(() => {
          Leaderboard.renderCompact('lbPreview', 5);
        });
      }
    } else {
      // Signed out
      if (authSigninBox) authSigninBox.classList.remove('hidden');
      if (authUserInfo) authUserInfo.classList.add('hidden');
    }
  }

  // ── Google Sign-In ──────────────────────────────────────────
  async function signInWithGoogle() {
    init();
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      showToast(I18n.t('signed_google'), 'success');
    } catch (e) {
      console.error('[Firebase] Google sign-in failed:', e);
      if (e.code === 'auth/popup-closed-by-user') return;
      showToast(I18n.t('signin_failed'), 'error');
    }
  }

  // ── Email/Password Registration ─────────────────────────────
  async function registerWithEmail(email, password) {
    init();
    try {
      await auth.createUserWithEmailAndPassword(email, password);
      showToast(I18n.t('account_created'), 'success');
    } catch (e) {
      console.error('[Firebase] Email register failed:', e);
      const msg = {
        'auth/email-already-in-use': I18n.t('email_in_use'),
        'auth/weak-password': I18n.t('weak_password'),
        'auth/invalid-email': I18n.t('invalid_email'),
      }[e.code] || I18n.t('reg_failed');
      showToast(msg, 'error');
    }
  }

  // ── Email/Password Login ────────────────────────────────────
  async function signInWithEmail(email, password) {
    init();
    try {
      await auth.signInWithEmailAndPassword(email, password);
      showToast(I18n.t('signed_in'), 'success');
    } catch (e) {
      console.error('[Firebase] Email sign-in failed:', e);
      const msg = {
        'auth/user-not-found': I18n.t('user_not_found'),
        'auth/wrong-password': I18n.t('wrong_password'),
        'auth/invalid-email': I18n.t('invalid_email'),
        'auth/invalid-credential': I18n.t('wrong_credential'),
      }[e.code] || I18n.t('signin_failed');
      showToast(msg, 'error');
    }
  }

  // ── Sign Out ────────────────────────────────────────────────
  async function signOut() {
    try {
      await auth.signOut();
      showToast(I18n.t('signed_out'), 'info');
    } catch (e) {
      console.error('[Firebase] Sign-out failed:', e);
    }
  }

  // ── Sync Profile to Database ────────────────────────────────
  async function syncProfileToDB() {
    if (!currentUser) return;
    const profile = typeof PlayerProfile !== 'undefined' ? PlayerProfile.get() : null;
    const displayName = (profile ? profile.name : null) || currentUser.displayName || 'Ninja';
    const avatar = profile ? profile.avatar : '🥷';
    const data = {
      displayName,
      avatar,
      email: currentUser.email || '',
      lastLogin: firebase.database.ServerValue.TIMESTAMP,
    };
    // Include claimableTN if available
    if (profile && typeof profile.claimableTN === 'number') {
      data.claimableTN = profile.claimableTN;
    }
    // Merge — don't overwrite existing stats
    try {
      await db.ref('users/' + currentUser.uid).update(data);
      // Also update displayName in current week's leaderboard entry
      await updateLeaderboardName(displayName, avatar);
    } catch (e) {
      console.error('[Firebase] Profile sync failed:', e);
    }
  }

  // ── Update displayName in leaderboard entries ─────────────────
  async function updateLeaderboardName(displayName, avatar) {
    if (!currentUser) return;
    const weekKey = getWeekKey();
    const uid = currentUser.uid;
    try {
      const snap = await db.ref(`leaderboard/${weekKey}/${uid}`).once('value');
      if (snap.exists()) {
        const updates = { displayName };
        if (avatar) updates.avatar = avatar;
        await db.ref(`leaderboard/${weekKey}/${uid}`).update(updates);
        console.log('[Firebase] Leaderboard name updated');
      }
    } catch (e) {
      console.error('[Firebase] Leaderboard name update failed:', e);
    }
  }

  // ── Sync claimableTN to Firebase ──────────────────────────────
  async function syncTN(tn) {
    if (!currentUser) return;
    try {
      await db.ref('users/' + currentUser.uid).update({ claimableTN: tn });
    } catch (e) {
      console.error('[Firebase] TN sync failed:', e);
    }
  }

  // ── Load claimableTN from Firebase (merge with local) ─────────
  async function loadTNFromDB() {
    if (!currentUser) return;
    try {
      const snap = await db.ref('users/' + currentUser.uid + '/claimableTN').once('value');
      const remoteTN = snap.val() || 0;
      if (typeof PlayerProfile !== 'undefined') {
        const profile = PlayerProfile.get();
        const localTN = profile.claimableTN || 0;
        // Take the higher value (in case user earned TN on another device)
        const merged = Math.max(localTN, remoteTN);
        if (merged !== localTN) {
          profile.claimableTN = merged;
          PlayerProfile.save();
        }
        // Push merged value back to Firebase
        if (merged !== remoteTN) {
          await db.ref('users/' + currentUser.uid).update({ claimableTN: merged });
        }
      }
    } catch (e) {
      console.error('[Firebase] TN load failed:', e);
    }
  }

  // ── Submit Score to Leaderboard ─────────────────────────────
  async function submitScore(score, stats = {}) {
    if (!currentUser) return null;

    const profile = typeof PlayerProfile !== 'undefined' ? PlayerProfile.get() : null;
    const weekKey = getWeekKey();
    const uid     = currentUser.uid;

    const entry = {
      uid,
      displayName: profile ? profile.name : (currentUser.displayName || 'Ninja'),
      avatar: profile ? profile.avatar : '🥷',
      score,
      stats,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };

    try {
      // Read current best for this user this week
      const snap = await db.ref(`leaderboard/${weekKey}/${uid}`).once('value');
      const existing = snap.val();

      // Only write if new score is higher
      if (!existing || score > existing.score) {
        await db.ref(`leaderboard/${weekKey}/${uid}`).set(entry);
      }

      // Update user stats
      const userRef = db.ref('users/' + uid);
      const userSnap = await userRef.once('value');
      const userData = userSnap.val() || {};
      await userRef.update({
        gamesPlayed: (userData.gamesPlayed || 0) + 1,
        bestScore: Math.max(userData.bestScore || 0, score),
        totalKills: (userData.totalKills || 0) + (stats.kills || 0),
      });

      return true;
    } catch (e) {
      console.error('[Firebase] Score submit failed:', e);
      return null;
    }
  }

  // ── Fetch Leaderboard from Firebase ─────────────────────────
  async function fetchLeaderboard(maxRows = 10) {
    init();
    const weekKey = getWeekKey();

    try {
      const snap = await db.ref(`leaderboard/${weekKey}`)
        .orderByChild('score')
        .limitToLast(maxRows)
        .once('value');

      const entries = [];
      snap.forEach(child => {
        entries.push(child.val());
      });

      // Sort descending (Firebase orderByChild is ascending)
      entries.sort((a, b) => b.score - a.score);

      // Cache locally for offline rendering
      try {
        localStorage.setItem('firebase_lb_cache', JSON.stringify(entries));
      } catch (e) { /* ignore */ }

      return entries;
    } catch (e) {
      console.error('[Firebase] Leaderboard fetch failed:', e);
      // Fallback to cache
      try {
        return JSON.parse(localStorage.getItem('firebase_lb_cache') || '[]');
      } catch { return []; }
    }
  }

  // ── Get My Firebase Rank ────────────────────────────────────
  async function getMyRank() {
    if (!currentUser) return null;
    const entries = await fetchLeaderboard(50);
    const idx = entries.findIndex(e => e.uid === currentUser.uid);
    return idx >= 0 ? { rank: idx + 1, entry: entries[idx] } : null;
  }

  // ── Week Key ────────────────────────────────────────────────
  function getWeekKey() {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    return 'week_' + Math.floor(Date.now() / WEEK_MS);
  }

  // ── Helper ──────────────────────────────────────────────────
  function isSignedIn() {
    return !!currentUser;
  }

  function getUser() {
    return currentUser;
  }

  function getDisplayName() {
    if (!currentUser) return null;
    const profile = typeof PlayerProfile !== 'undefined' ? PlayerProfile.get() : null;
    return profile ? profile.name : (currentUser.displayName || currentUser.email || 'Ninja');
  }

  // ── Wire Auth Panel UI ──────────────────────────────────────
  function wireAuthUI() {
    init();

    // Google sign-in button
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.onclick = signInWithGoogle;

    // Email form toggle
    const emailToggle = document.getElementById('emailToggleBtn');
    const emailForm   = document.getElementById('emailFormBox');
    if (emailToggle && emailForm) {
      emailToggle.onclick = () => emailForm.classList.toggle('hidden');
    }

    // Email submit (login or register)
    const emailSubmit = document.getElementById('emailSubmitBtn');
    const emailRegister = document.getElementById('emailRegisterBtn');
    if (emailSubmit) {
      emailSubmit.onclick = () => {
        const email = document.getElementById('authEmail').value.trim();
        const pass  = document.getElementById('authPassword').value;
        if (!email || !pass) return showToast(I18n.t('fill_email_pass'), 'error');
        signInWithEmail(email, pass);
      };
    }
    if (emailRegister) {
      emailRegister.onclick = () => {
        const email = document.getElementById('authEmail').value.trim();
        const pass  = document.getElementById('authPassword').value;
        if (!email || !pass) return showToast(I18n.t('fill_email_pass'), 'error');
        registerWithEmail(email, pass);
      };
    }

    // Sign out button
    const signOutBtn = document.getElementById('authSignOutBtn');
    if (signOutBtn) signOutBtn.onclick = signOut;
  }

  // ── Public API ──────────────────────────────────────────────
  return {
    init,
    wireAuthUI,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    signOut,
    submitScore,
    fetchLeaderboard,
    getMyRank,
    syncProfileToDB,
    syncTN,
    loadTNFromDB,
    isSignedIn,
    getUser,
    getDisplayName,
    getWeekKey,
  };

})();
