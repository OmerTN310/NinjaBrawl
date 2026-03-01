/* ============================================================
   i18n.js — Language Toggle (English / Hebrew)
   ============================================================ */

const I18n = (() => {

  const STORAGE_KEY = 'ninja_lang';
  let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';

  // ── Translation Dictionary ──────────────────────────────────
  const STRINGS = {

    // ── Splash / Logo ──
    splash_title:     { en: 'NINJA BRAWL',           he: 'NINJA BRAWL' },
    splash_sub:       { en: 'POWERED BY NINJACOIN',   he: 'POWERED BY NINJACOIN' },

    // ── Menu Buttons ──
    play:             { en: 'PLAY',                   he: '\u05E9\u05D7\u05E7' },
    play_online:      { en: 'PLAY ONLINE',            he: '\u05E9\u05D7\u05E7 \u05D0\u05D5\u05E0\u05DC\u05D9\u05D9\u05DF' },
    characters:       { en: 'CHARACTERS',             he: '\u05D3\u05DE\u05D5\u05D9\u05D5\u05EA' },
    profile:          { en: 'PROFILE',                he: '\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC' },
    leaderboard:      { en: 'LEADERBOARD',            he: '\u05D8\u05D1\u05DC\u05EA \u05DE\u05D5\u05D1\u05D9\u05DC\u05D9\u05DD' },

    // ── Auth ──
    sign_in_google:   { en: 'SIGN IN WITH GOOGLE',    he: '\u05D4\u05EA\u05D7\u05D1\u05E8 \u05E2\u05DD GOOGLE' },
    sign_in_email:    { en: 'SIGN IN WITH EMAIL',     he: '\u05D4\u05EA\u05D7\u05D1\u05E8 \u05E2\u05DD \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC' },
    login:            { en: 'LOGIN',                  he: '\u05D4\u05EA\u05D7\u05D1\u05E8' },
    register:         { en: 'REGISTER',               he: '\u05D4\u05E8\u05E9\u05DE\u05D4' },
    sign_out:         { en: 'SIGN OUT',               he: '\u05D4\u05EA\u05E0\u05EA\u05E7' },
    email_placeholder:{ en: 'Email',                  he: '\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC' },
    password_placeholder: { en: 'Password',           he: '\u05E1\u05D9\u05E1\u05DE\u05D0' },

    // ── Wallet ──
    connect_wallet:   { en: 'CONNECT WALLET',         he: '\u05D7\u05D1\u05E8 \u05D0\u05E8\u05E0\u05E7' },
    wallet_not_connected: { en: 'Wallet not connected', he: '\u05D0\u05E8\u05E0\u05E7 \u05DC\u05D0 \u05DE\u05D7\u05D5\u05D1\u05E8' },
    not_connected:    { en: 'Not connected',          he: '\u05DC\u05D0 \u05DE\u05D7\u05D5\u05D1\u05E8' },

    // ── Profile Modal ──
    player_name:      { en: 'PLAYER NAME',            he: '\u05E9\u05DD \u05E9\u05D7\u05E7\u05DF' },
    player_name_placeholder: { en: 'NinjaPlayer',     he: 'NinjaPlayer' },
    games_played:     { en: 'GAMES PLAYED',           he: '\u05DE\u05E9\u05D7\u05E7\u05D9\u05DD' },
    best_score:       { en: 'BEST SCORE',             he: '\u05E9\u05D9\u05D0 \u05D2\u05D1\u05D5\u05D4' },
    total_kills:      { en: 'TOTAL KILLS',            he: '\u05D4\u05E8\u05D9\u05D2\u05D5\u05EA' },
    best_accuracy:    { en: 'BEST ACCURACY',          he: '\u05D3\u05D9\u05D5\u05E7 \u05D2\u05D1\u05D5\u05D4' },
    weekly_rank:      { en: 'WEEKLY RANK',            he: '\u05D3\u05D9\u05E8\u05D5\u05D2 \u05E9\u05D1\u05D5\u05E2\u05D9' },
    win_plus_tn:      { en: 'WIN = +1 TN',            he: '\u05E0\u05D9\u05E6\u05D7\u05D5\u05DF = +1 TN' },
    claim_tn:         { en: 'CLAIM TN',               he: '\u05DE\u05E9\u05D9\u05DB\u05EA TN' },
    no_tn_to_claim:   { en: 'NO TN TO CLAIM',         he: '\u05D0\u05D9\u05DF TN \u05DC\u05DE\u05E9\u05D9\u05DB\u05D4' },
    tn_connect_wallet:{ en: 'TN \u2014 CONNECT WALLET TO CLAIM', he: 'TN \u2014 \u05D7\u05D1\u05E8 \u05D0\u05E8\u05E0\u05E7 \u05DC\u05DE\u05E9\u05D9\u05DB\u05D4' },

    // ── Character Select ──
    select_character: { en: 'SELECT CHARACTER',        he: '\u05D1\u05D7\u05E8 \u05D3\u05DE\u05D5\u05EA' },
    selected:         { en: 'SELECTED',                he: '\u05E0\u05D1\u05D7\u05E8' },
    select:           { en: 'SELECT',                  he: '\u05D1\u05D7\u05E8' },
    unlock:           { en: 'UNLOCK',                  he: '\u05E4\u05EA\u05D7' },
    bounce_tag:       { en: 'BOUNCE',                  he: '\u05E7\u05E4\u05D9\u05E6\u05D4' },
    spread_tag:       { en: 'SPREAD',                  he: '\u05E4\u05D9\u05D6\u05D5\u05E8' },
    heal_tag:         { en: 'HEAL 50%',                he: '\u05E8\u05D9\u05E4\u05D5\u05D9 50%' },
    explosion_tag:    { en: 'EXPLOSION',               he: '\u05E4\u05D9\u05E6\u05D5\u05E5' },
    // Character descriptions
    shadow_desc:      { en: 'Classic spread shots. Explosive ultimate.', he: '\u05D9\u05E8\u05D9\u05D5\u05EA \u05E4\u05D9\u05D6\u05D5\u05E8. \u05D0\u05DC\u05D8\u05D9\u05DE\u05D8 \u05E0\u05E4\u05D9\u05E5.' },
    phantom_desc:     { en: 'Bouncing line shots. Heals 50% HP.', he: '\u05D9\u05E8\u05D9\u05D5\u05EA \u05E7\u05D5\u05E4\u05E6\u05D5\u05EA. \u05E8\u05D9\u05E4\u05D5\u05D9 50% HP.' },

    // ── Game HUD ──
    you_label:        { en: 'YOU',                     he: '\u05D0\u05EA\u05D4' },
    enemy_label:      { en: 'ENEMY',                   he: '\u05D0\u05D5\u05D9\u05D1' },
    ultimate:         { en: 'ULTIMATE',                he: '\u05D0\u05DC\u05D8\u05D9\u05DE\u05D8' },
    score_label:      { en: 'SCORE',                   he: '\u05E0\u05D9\u05E7\u05D5\u05D3' },
    move_label:       { en: 'MOVE',                    he: '\u05D6\u05D5\u05D6' },
    aim_label:        { en: 'AIM',                     he: '\u05DB\u05D9\u05D5\u05D5\u05DF' },
    ult_label:        { en: 'ULT',                     he: 'ULT' },

    // ── Pause / Game Over ──
    paused:           { en: 'PAUSED',                  he: '\u05DE\u05D5\u05E9\u05D4\u05D4' },
    resume:           { en: 'RESUME',                  he: '\u05D4\u05DE\u05E9\u05DA' },
    quit:             { en: 'QUIT',                    he: '\u05D9\u05E6\u05D9\u05D0\u05D4' },
    play_again:       { en: 'PLAY AGAIN',              he: '\u05E9\u05D7\u05E7 \u05E9\u05D5\u05D1' },
    menu:             { en: 'MENU',                    he: '\u05EA\u05E4\u05E8\u05D9\u05D8' },

    // ── Game Results ──
    victory:          { en: 'VICTORY',                 he: '\u05E0\u05D9\u05E6\u05D7\u05D5\u05DF' },
    defeated:         { en: 'DEFEATED',                he: '\u05D4\u05E4\u05E1\u05D3' },
    draw:             { en: 'DRAW',                    he: '\u05EA\u05D9\u05E7\u05D5' },
    times_up:         { en: "TIME'S UP",               he: '\u05D4\u05D6\u05DE\u05DF \u05E0\u05D2\u05DE\u05E8' },
    opponent_left:    { en: 'OPPONENT LEFT',           he: '\u05D9\u05E8\u05D9\u05D1 \u05E2\u05D6\u05D1' },
    disconnected:     { en: 'DISCONNECTED',            he: '\u05E0\u05D5\u05EA\u05E7' },
    kills_stat:       { en: 'Kills',                   he: '\u05D4\u05E8\u05D9\u05D2\u05D5\u05EA' },
    accuracy_stat:    { en: 'Accuracy',                he: '\u05D3\u05D9\u05D5\u05E7' },
    hp_left:          { en: 'HP Left',                 he: 'HP \u05E0\u05D5\u05EA\u05E8' },
    time_left:        { en: 'Time Left',               he: '\u05D6\u05DE\u05DF \u05E0\u05D5\u05EA\u05E8' },
    weekly_rank_num:  { en: 'WEEKLY RANK:',            he: '\u05D3\u05D9\u05E8\u05D5\u05D2 \u05E9\u05D1\u05D5\u05E2\u05D9:' },
    number1_ninja:    { en: "YOU'RE THIS WEEK'S #1 NINJA!", he: '\u05D0\u05EA\u05D4 \u05D4\u05E0\u05D9\u05E0\u05D2\u05B3\u05D4 #1 \u05D4\u05E9\u05D1\u05D5\u05E2!' },

    // ── Matchmaking ──
    matchmaking:      { en: 'MATCHMAKING',             he: '\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D9\u05E8\u05D9\u05D1' },
    connecting:       { en: 'Connecting to server...',  he: '...\u05DE\u05EA\u05D7\u05D1\u05E8 \u05DC\u05E9\u05E8\u05EA' },
    searching:        { en: 'Searching for opponent...', he: '...\u05DE\u05D7\u05E4\u05E9 \u05D9\u05E8\u05D9\u05D1' },
    opponent_found:   { en: 'Opponent found!',          he: '!\u05E0\u05DE\u05E6\u05D0 \u05D9\u05E8\u05D9\u05D1' },
    cancel:           { en: 'CANCEL',                   he: '\u05D1\u05D9\u05D8\u05D5\u05DC' },
    reconnecting:     { en: 'Reconnecting...',          he: '...\u05DE\u05EA\u05D7\u05D1\u05E8 \u05DE\u05D7\u05D3\u05E9' },

    // ── Leaderboard ──
    weekly_leaderboard: { en: 'WEEKLY LEADERBOARD',    he: '\u05D8\u05D1\u05DC\u05EA \u05DE\u05D5\u05D1\u05D9\u05DC\u05D9\u05DD \u05E9\u05D1\u05D5\u05E2\u05D9\u05EA' },
    top_ninjas:       { en: "THIS WEEK'S TOP NINJAS",  he: '\u05D4\u05E0\u05D9\u05E0\u05D2\u05B3\u05D5\u05EA \u05D4\u05DE\u05D5\u05D1\u05D9\u05DC\u05D9\u05DD \u05D4\u05E9\u05D1\u05D5\u05E2' },
    your_rank:        { en: 'YOUR RANK THIS WEEK',     he: '\u05D4\u05D3\u05D9\u05E8\u05D5\u05D2 \u05E9\u05DC\u05DA \u05D4\u05E9\u05D1\u05D5\u05E2' },
    back:             { en: 'BACK',                    he: '\u05D7\u05D6\u05D5\u05E8' },
    no_entries:       { en: 'NO ENTRIES YET',           he: '\u05D0\u05D9\u05DF \u05E8\u05E9\u05D5\u05DE\u05D5\u05EA \u05E2\u05D3\u05D9\u05D9\u05DF' },
    resets_in:        { en: 'Resets in:',               he: ':\u05D0\u05D9\u05E4\u05D5\u05E1 \u05D1\u05E2\u05D5\u05D3' },
    you_marker:       { en: 'YOU',                      he: '\u05D0\u05EA\u05D4' },
    sign_in_lb:       { en: 'Sign in to appear on the leaderboard!', he: '!\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D5\u05E4\u05D9\u05E2 \u05D1\u05D8\u05D1\u05DC\u05D4' },
    sign_in_lb_toast: { en: 'Sign in to appear on the global leaderboard!', he: '!\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DB\u05D3\u05D9 \u05DC\u05D4\u05D5\u05E4\u05D9\u05E2 \u05D1\u05D8\u05D1\u05DC\u05D4 \u05D4\u05E2\u05D5\u05DC\u05DE\u05D9\u05EA' },

    // ── Toast Messages ──
    install_metamask: { en: 'Please install MetaMask!', he: '!\u05D4\u05EA\u05E7\u05DF MetaMask' },
    connecting_wallet:{ en: 'Connecting wallet...',     he: '...\u05DE\u05D7\u05D1\u05E8 \u05D0\u05E8\u05E0\u05E7' },
    wallet_connected: { en: 'Wallet connected!',        he: '!\u05D0\u05E8\u05E0\u05E7 \u05D7\u05D5\u05D1\u05E8' },
    connection_failed:{ en: 'Connection failed. Try again.', he: '.\u05D4\u05D7\u05D9\u05D1\u05D5\u05E8 \u05E0\u05DB\u05E9\u05DC. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1' },
    connect_first:    { en: 'Connect wallet first!',    he: '!\u05D7\u05D1\u05E8 \u05D0\u05E8\u05E0\u05E7 \u05E7\u05D5\u05D3\u05DD' },
    no_tn_win:        { en: 'No TN to claim. Win games!', he: '!\u05D0\u05D9\u05DF TN. \u05E0\u05E6\u05D7 \u05D1\u05DE\u05E9\u05D7\u05E7\u05D9\u05DD' },
    switch_base:      { en: 'Switching to Base network...', he: '...Base \u05E2\u05D5\u05D1\u05E8 \u05DC\u05E8\u05E9\u05EA' },
    confirm_wallet:   { en: 'Confirm transaction in MetaMask...', he: '...MetaMask \u05D0\u05E9\u05E8 \u05D1' },
    tx_sent:          { en: 'Transaction sent! Waiting...', he: '...\u05D4\u05E2\u05E1\u05E7\u05D4 \u05E0\u05E9\u05DC\u05D7\u05D4! \u05DE\u05DE\u05EA\u05D9\u05DF' },
    admin_only:       { en: 'Only the game admin can mint TN. Ask the admin to send rewards.', he: '.\u05E8\u05E7 \u05DE\u05E0\u05D4\u05DC \u05D4\u05DE\u05E9\u05D7\u05E7 \u05D9\u05DB\u05D5\u05DC \u05DC\u05D9\u05E6\u05D5\u05E8 TN' },
    claimed:          { en: 'CLAIMED!',                 he: '!\u05E0\u05DE\u05E9\u05DA' },
    switch_to_base:   { en: 'Please switch to Base network!', he: '!Base \u05E2\u05D1\u05D5\u05E8 \u05DC\u05E8\u05E9\u05EA' },
    tx_cancelled:     { en: 'Transaction cancelled.',   he: '.\u05D4\u05E2\u05E1\u05E7\u05D4 \u05D1\u05D5\u05D8\u05DC\u05D4' },
    tx_reverted:      { en: 'Transaction reverted. Check you are the contract owner.', he: '.\u05D4\u05E2\u05E1\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4. \u05D5\u05D3\u05D0 \u05E9\u05D0\u05EA\u05D4 \u05D1\u05E2\u05DC \u05D4\u05D7\u05D5\u05D6\u05D4' },
    tx_failed:        { en: 'Transaction failed:',      he: ':\u05D4\u05E2\u05E1\u05E7\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4' },
    confirm_burn:     { en: 'Confirm burn in wallet...', he: '...\u05D0\u05E9\u05E8 \u05E9\u05E8\u05D9\u05E4\u05D4 \u05D1\u05D0\u05E8\u05E0\u05E7' },
    burning_tn:       { en: 'Burning TN...',            he: '...\u05E9\u05D5\u05E8\u05E3 TN' },
    not_enough_tn:    { en: 'Not enough TN! You have',  he: '!\u05D0\u05D9\u05DF \u05DE\u05E1\u05E4\u05D9\u05E7 TN. \u05D9\u05E9 \u05DC\u05DA' },
    need_tn:          { en: 'Need',                     he: '\u05E6\u05E8\u05D9\u05DA' },
    burn_failed:      { en: 'Burn failed:',             he: ':\u05D4\u05E9\u05E8\u05D9\u05E4\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4' },
    unlocked:         { en: 'unlocked!',                he: '!\u05E0\u05E4\u05EA\u05D7' },
    fill_email_pass:  { en: 'Fill in email & password', he: '\u05DE\u05DC\u05D0 \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D5\u05E1\u05D9\u05E1\u05DE\u05D0' },

    // ── Firebase Auth Toasts ──
    signed_google:    { en: 'Signed in with Google!',   he: '!Google \u05DE\u05D7\u05D5\u05D1\u05E8 \u05E2\u05DD' },
    signin_failed:    { en: 'Sign-in failed. Try again.', he: '.\u05D4\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA \u05E0\u05DB\u05E9\u05DC\u05D4. \u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1' },
    account_created:  { en: 'Account created!',         he: '!\u05D7\u05E9\u05D1\u05D5\u05DF \u05E0\u05D5\u05E6\u05E8' },
    email_in_use:     { en: 'Email already in use.',    he: '.\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DB\u05D1\u05E8 \u05D1\u05E9\u05D9\u05DE\u05D5\u05E9' },
    weak_password:    { en: 'Password too weak (min 6 chars).', he: '.\u05E1\u05D9\u05E1\u05DE\u05D0 \u05D7\u05DC\u05E9\u05D4 (\u05DE\u05D9\u05E0\u05D9\u05DE\u05D5\u05DD 6 \u05EA\u05D5\u05D5\u05D9\u05DD)' },
    invalid_email:    { en: 'Invalid email address.',   he: '.\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF' },
    reg_failed:       { en: 'Registration failed.',     he: '.\u05D4\u05D4\u05E8\u05E9\u05DE\u05D4 \u05E0\u05DB\u05E9\u05DC\u05D4' },
    user_not_found:   { en: 'No account with this email.', he: '.\u05D0\u05D9\u05DF \u05D7\u05E9\u05D1\u05D5\u05DF \u05E2\u05DD \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D6\u05D4' },
    wrong_password:   { en: 'Wrong password.',          he: '.\u05E1\u05D9\u05E1\u05DE\u05D0 \u05E9\u05D2\u05D5\u05D9\u05D4' },
    wrong_credential: { en: 'Wrong email or password.', he: '.\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05D0\u05D5 \u05E1\u05D9\u05E1\u05DE\u05D0 \u05E9\u05D2\u05D5\u05D9\u05D9\u05DD' },
    signed_in:        { en: 'Signed in!',               he: '!\u05DE\u05D7\u05D5\u05D1\u05E8' },
    signed_out:       { en: 'Signed out.',              he: '.\u05D4\u05EA\u05E0\u05EA\u05E7\u05EA' },

    // ── AI State Labels ──
    ai_chase:         { en: 'CHASING \u25b6',           he: '\u05E8\u05D5\u05D3\u05E3 \u25b6' },
    ai_retreat:       { en: 'RETREATING \u25c0',        he: '\u05E0\u05E1\u05D5\u05D2 \u25c0' },
    ai_circle:        { en: 'CIRCLING \u21bb',          he: '\u05DE\u05E7\u05D9\u05E3 \u21bb' },
    ai_strafe:        { en: 'STRAFING \u21c4',          he: '\u05D7\u05DE\u05E7\u05E0\u05D9 \u21c4' },
    ai_ambush:        { en: 'FLANKING \u25c8',          he: '\u05E2\u05D5\u05E7\u05E3 \u25c8' },
    ai_dodge:         { en: 'DODGING \u26a1',           he: '\u05DE\u05EA\u05D7\u05DE\u05E7 \u26a1' },
    ai_burst:         { en: 'BURST FIRE \ud83d\udd25',  he: '\u05D9\u05E8\u05D9 \u05DE\u05D4\u05D9\u05E8 \ud83d\udd25' },
    ai_combo:         { en: 'COMBO RUSH \u2694',        he: '\u05E7\u05D5\u05DE\u05D1\u05D5 \u2694' },
    ai_feint:         { en: 'FEINT \u2727',             he: '\u05D4\u05D8\u05E2\u05D9\u05D4 \u2727' },
    ai_shield:        { en: 'SHIELDED \u26e8',          he: '\u05DE\u05D2\u05DF \u26e8' },
    ai_ult:           { en: 'ULTIMATE \ud83d\udca5',    he: '\u05D0\u05DC\u05D8\u05D9\u05DE\u05D8 \ud83d\udca5' },
    pvp:              { en: 'PVP',                      he: 'PVP' },

    // ── Misc ──
    checking:         { en: 'CHECKING...',              he: '...\u05D1\u05D5\u05D3\u05E7' },
    confirming:       { en: 'CONFIRMING...',            he: '...\u05DE\u05D0\u05E9\u05E8' },
    go:               { en: 'GO!',                      he: '!\u05E7\u05D3\u05D9\u05DE\u05D4' },
  };

  // ── Core Functions ──────────────────────────────────────────

  function t(key) {
    const entry = STRINGS[key];
    if (!entry) return key;
    return entry[currentLang] || entry.en || key;
  }

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    // Update HTML direction and lang
    document.documentElement.lang = lang;
    document.documentElement.dir  = lang === 'he' ? 'rtl' : 'ltr';

    // Re-render all data-i18n elements
    applyAll();
  }

  function toggle() {
    setLang(currentLang === 'en' ? 'he' : 'en');
    updateToggleBtn();
  }

  function updateToggleBtn() {
    const label = document.getElementById('langToggleLabel');
    if (label) {
      label.textContent = currentLang === 'en' ? 'Switch to עברית' : 'Switch to English';
    }
  }

  function applyAll() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    // Placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
      const key = el.getAttribute('data-i18n-ph');
      el.placeholder = t(key);
    });
  }

  // Apply on load
  function init() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir  = currentLang === 'he' ? 'rtl' : 'ltr';
    applyAll();

    // Wire toggle button if present
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
      btn.onclick = toggle;
      updateToggleBtn();
    }
  }

  return { t, getLang, setLang, toggle, applyAll, init, STRINGS };

})();
