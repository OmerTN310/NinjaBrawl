/* ============================================================
   app.js — Wallet Connection + NinjaCoin Contract
   ============================================================ */

const NINJA_CONTRACT_ADDR = "0x51cD66dbbd4d32a49ee6eB9a7278231a3fd40987";

const NINJA_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to",    "type": "address" },
      { "internalType": "uint256", "name": "value", "type": "uint256" }
    ],
    "name": "transfer",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to",     "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address[]", "name": "recipients", "type": "address[]" },
      { "internalType": "uint256[]", "name": "amounts",    "type": "uint256[]" }
    ],
    "name": "batchTransfer",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "burn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// ── Global Wallet State ───────────────────────────────────────
window.WalletState = {
  provider:  null,
  signer:    null,
  contract:  null,
  address:   null,
  balance:   0,
  connected: false,
};

// ══════════════════════════════════════════════════════════════
// CONNECT WALLET
// ══════════════════════════════════════════════════════════════
async function connectWallet() {
  if (!window.ethereum) {
    // Mobile: open dApp inside MetaMask in-app browser
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      const dappUrl = window.location.href.replace(/^https?:\/\//, '');
      window.location.href = `https://metamask.app.link/dapp/${dappUrl}`;
      return false;
    }
    showToast(I18n.t('install_metamask') + ' 🦊', 'error');
    return false;
  }

  try {
    showToast(I18n.t('connecting_wallet'), 'info');

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    const signer   = provider.getSigner();
    const address  = await signer.getAddress();

    // Check we're on Base (chainId 8453)
    const network  = await provider.getNetwork();
    if (network.chainId !== 8453) {
      await switchToBase();
    }

    const contract = new ethers.Contract(
      NINJA_CONTRACT_ADDR,
      NINJA_ABI,
      signer
    );

    // Save globally
    WalletState.provider  = provider;
    WalletState.signer    = signer;
    WalletState.contract  = contract;
    WalletState.address   = address;
    WalletState.connected = true;

    window._walletAddr = address;
    localStorage.setItem('ninja_wallet', address);

    await refreshBalance();
    updateWalletUI();

    // Listen for changes
    window.ethereum.on('accountsChanged', () => window.location.reload());
    window.ethereum.on('chainChanged',    () => window.location.reload());

    showToast(I18n.t('wallet_connected') + ' 🥷', 'success');
    return true;

  } catch (e) {
    console.error('Wallet connection failed:', e);
    showToast(I18n.t('connection_failed'), 'error');
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// SWITCH TO BASE NETWORK
// ══════════════════════════════════════════════════════════════
async function switchToBase() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }], // 8453 in hex
    });
  } catch (switchError) {
    // Chain not added yet — add it
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId:         '0x2105',
          chainName:       'Base',
          nativeCurrency:  { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          rpcUrls:         ['https://mainnet.base.org'],
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    }
  }
}

// ══════════════════════════════════════════════════════════════
// REFRESH BALANCE
// ══════════════════════════════════════════════════════════════
async function refreshBalance() {
  if (!WalletState.contract || !WalletState.address) return;
  try {
    const raw = await WalletState.contract.balanceOf(WalletState.address);
    WalletState.balance = Math.floor(
      Number(ethers.utils.formatEther(raw))
    );
  } catch (e) {
    console.error('Balance fetch failed:', e);
  }
}

// ══════════════════════════════════════════════════════════════
// UPDATE UI
// ══════════════════════════════════════════════════════════════
function updateWalletUI() {
  const { address, connected } = WalletState;
  const profile = PlayerProfile.get();

  const connectBtn = document.getElementById('connectBtn');
  const addrEl     = document.getElementById('walletAddress');
  const balEl      = document.getElementById('walletBalance');

  // Always show TN balance
  if (balEl) {
    balEl.textContent = (profile.claimableTN || 0) + ' TN';
  }

  if (connected) {
    // Hide connect button, show address
    if (connectBtn) connectBtn.classList.add('hidden');
    if (addrEl) addrEl.textContent = address.slice(0, 6) + '...' + address.slice(-4);
  } else {
    // Show connect button, show "not connected"
    if (connectBtn) connectBtn.classList.remove('hidden');
    if (addrEl) addrEl.textContent = I18n.t('wallet_not_connected');
  }
}

// ══════════════════════════════════════════════════════════════
// CLAIM REWARD
// ══════════════════════════════════════════════════════════════
async function handleClaim() {
  const winner = Leaderboard.getLastWeekWinner();

  if (!winner) {
    showToast(I18n.t('no_tn_win'), 'info');
    return;
  }

  if (winner.addr !== WalletState.address) {
    showToast(`Last week's winner: ${winner.name}`, 'info');
    return;
  }

  showToast(
    `You won ${Leaderboard.PRIZE_TN} TN last week! Contact @NinjaCoin to claim.`,
    'success'
  );

  // Phase 3: Auto-send via batchTransfer
  // await sendReward(winner.addr, Leaderboard.PRIZE_TN);
}

// ══════════════════════════════════════════════════════════════
// SEND REWARD (Phase 3 — owner only)
// ══════════════════════════════════════════════════════════════
async function sendReward(toAddress, amountTN) {
  if (!WalletState.contract) return;
  try {
    const amount = ethers.utils.parseEther(amountTN.toString());
    const tx     = await WalletState.contract.transfer(toAddress, amount);
    await tx.wait();
    showToast(`Sent ${amountTN} TN to ${toAddress.slice(0,6)}...`, 'success');
    await refreshBalance();
    updateWalletUI();
  } catch (e) {
    console.error('Send reward failed:', e);
    showToast('Transaction failed.', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════
function showToast(message, type = 'info') {
  // Remove existing toast
  const existing = document.getElementById('ninja-toast');
  if (existing) existing.remove();

  const colors = {
    success: '#00ffcc',
    error:   '#ff3355',
    info:    '#ffd700',
  };

  const toast = document.createElement('div');
  toast.id    = 'ninja-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10,10,20,0.95);
    border: 1px solid ${colors[type]};
    color: ${colors[type]};
    font-family: 'Orbitron', monospace;
    font-size: 0.7rem;
    letter-spacing: 2px;
    padding: 12px 24px;
    border-radius: 6px;
    z-index: 999;
    box-shadow: 0 0 20px ${colors[type]}44;
    animation: slideUp 0.3s ease-out;
    max-width: 90vw;
    text-align: center;
    pointer-events: none;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity    = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ══════════════════════════════════════════════════════════════
// CHARACTER DEFINITIONS
// ══════════════════════════════════════════════════════════════
const CHARACTERS = {
  shadow: {
    id:           'shadow',
    name:         'Shadow Ninja',
    emoji:        '🥷',
    color:        '#00ffcc',
    bulletColor:  '#00ffcc',
    bulletBounce: false,
    bulletLife:    0.8,
    ultType:      'explosion',
    shootPattern: 'spread',
    cost:         0,
    descKey:      'shadow_desc',
    description:  'Classic spread shots. Explosive ultimate.',
  },
  phantom: {
    id:           'phantom',
    name:         'Phantom',
    emoji:        '👻',
    color:        '#bb66ff',
    bulletColor:  '#bb66ff',
    bulletBounce: true,
    bulletLife:    1.2,
    ultType:      'heal',
    shootPattern: 'line',
    cost:         10,
    descKey:      'phantom_desc',
    description:  'Bouncing line shots. Heals 50% HP.',
  },
};

// ══════════════════════════════════════════════════════════════
// PLAYER PROFILE
// ══════════════════════════════════════════════════════════════
const PlayerProfile = (() => {

  const STORAGE_KEY = 'ninja_profile';
  const AVATARS = ['🥷', '⚔️', '🗡️', '🎯', '🔥', '💀', '⚡', '🐉'];

  const DEFAULT = {
    name:           'NinjaPlayer',
    avatar:         '🥷',
    gamesPlayed:    0,
    bestScore:      0,
    totalKills:     0,
    bestAccuracy:   0,
    claimableTN:    0,
    selectedChar:   'shadow',
    unlockedChars:  ['shadow'],
  };

  let data = { ...DEFAULT };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) data = { ...DEFAULT, ...saved };
    } catch { /* use defaults */ }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { console.warn('Profile save failed', e); }
  }

  function get() { return data; }

  function setAvatar(emoji) {
    data.avatar = emoji;
    save();
    if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
      FirebaseAuth.syncProfileToDB();
    }
  }

  function setName(name) {
    const trimmed = name.trim().slice(0, 20);
    if (trimmed) {
      data.name = trimmed;
      save();
      // Sync to Firebase
      if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
        FirebaseAuth.syncProfileToDB();
      }
    }
  }

  function updateStats({ score, kills, accuracy, won }) {
    data.gamesPlayed++;
    if (score > data.bestScore) data.bestScore = score;
    data.totalKills += kills;
    if (accuracy > data.bestAccuracy) data.bestAccuracy = accuracy;
    if (won) data.claimableTN++;
    save();
    // Sync claimableTN to Firebase
    if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
      FirebaseAuth.syncTN(data.claimableTN);
    }
  }

  // ── Open Modal ──────────────────────────────────────────
  function openModal() {
    const backdrop = document.getElementById('profileBackdrop');
    if (!backdrop) return;

    // Populate data
    document.getElementById('profileAvatar').textContent  = data.avatar;
    document.getElementById('profileNameInput').value      = data.name;

    // Wallet info
    const addrEl = document.getElementById('profileWalletAddr');
    if (WalletState.connected) {
      const addr = WalletState.address;
      addrEl.textContent = addr.slice(0, 6) + '...' + addr.slice(-4);
    } else {
      addrEl.textContent = I18n.t('not_connected');
    }

    // Claimable TN
    document.getElementById('profileClaimableTN').textContent = data.claimableTN + ' TN';

    // Stats
    document.getElementById('statGames').textContent     = data.gamesPlayed;
    document.getElementById('statBestScore').textContent  = data.bestScore.toLocaleString();
    document.getElementById('statKills').textContent      = data.totalKills;
    document.getElementById('statAccuracy').textContent   = data.bestAccuracy + '%';

    // Weekly rank
    const myRank = Leaderboard.getMyRank();
    document.getElementById('profileRank').textContent =
      myRank ? '#' + myRank.rank : '—';

    // Build avatar picker
    const picker = document.getElementById('avatarPicker');
    picker.classList.add('hidden');
    picker.innerHTML = AVATARS.map(e =>
      `<div class="avatar-option${e === data.avatar ? ' selected' : ''}" data-emoji="${e}">${e}</div>`
    ).join('');

    // Connect wallet button in profile
    const profileConnectBtn = document.getElementById('profileConnectBtn');
    if (profileConnectBtn) {
      if (WalletState.connected) {
        profileConnectBtn.classList.add('hidden');
      } else {
        profileConnectBtn.classList.remove('hidden');
      }
    }

    // Claim button state
    const claimBtn = document.getElementById('profileClaimBtn');
    if (claimBtn) {
      if (data.claimableTN <= 0) {
        claimBtn.disabled = true;
        claimBtn.textContent = I18n.t('no_tn_to_claim');
      } else if (!WalletState.connected) {
        claimBtn.disabled = true;
        claimBtn.textContent = `${data.claimableTN} ${I18n.t('tn_connect_wallet')}`;
      } else {
        claimBtn.disabled = false;
        claimBtn.textContent = `${I18n.t('claim_tn')} ${data.claimableTN}`;
      }
    }

    backdrop.classList.remove('hidden');
  }

  function closeModal() {
    const backdrop = document.getElementById('profileBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
  }

  // ── Claim TN to Wallet ─────────────────────────────────
  async function claimTN() {
    if (!WalletState.connected) {
      showToast(I18n.t('connect_first'), 'error');
      return;
    }

    if (data.claimableTN <= 0) {
      showToast(I18n.t('no_tn_win'), 'info');
      return;
    }

    const amount = data.claimableTN;
    const claimBtn = document.getElementById('profileClaimBtn');

    try {
      // Disable button during transaction
      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.textContent = '⏳ ' + I18n.t('checking');
      }

      // 1. Verify we're on Base network
      const network = await WalletState.provider.getNetwork();
      if (network.chainId !== 8453) {
        showToast(I18n.t('switch_base'), 'info');
        await switchToBase();
        // Re-check after switch
        const net2 = await WalletState.provider.getNetwork();
        if (net2.chainId !== 8453) {
          throw new Error('NOT_BASE');
        }
      }

      // 2. Check if connected wallet is contract owner
      let isOwner = false;
      try {
        const ownerAddr = await WalletState.contract.owner();
        isOwner = ownerAddr.toLowerCase() === WalletState.address.toLowerCase();
        console.log('[Claim] Owner:', ownerAddr, '| You:', WalletState.address, '| isOwner:', isOwner);
      } catch (e) {
        console.warn('[Claim] Could not check owner:', e.message);
      }

      const amountWei = ethers.utils.parseEther(amount.toString());

      if (isOwner) {
        // Owner can mint new tokens
        if (claimBtn) claimBtn.textContent = '⏳ ' + I18n.t('confirm_wallet');
        showToast(I18n.t('confirm_wallet'), 'info');

        const tx = await WalletState.contract.mint(
          WalletState.address,
          amountWei,
          { gasLimit: 150000 }
        );

        if (claimBtn) claimBtn.textContent = '⏳ ' + I18n.t('confirming');
        showToast(I18n.t('tx_sent'), 'info');
        const receipt = await tx.wait();
        console.log('[Claim] Mint TX confirmed:', receipt.transactionHash);

      } else {
        // Non-owner: transfer from owner's balance (if owner pre-funded game rewards)
        // For now, show a clear message
        showToast(I18n.t('admin_only'), 'error');
        if (claimBtn) {
          claimBtn.disabled = false;
          claimBtn.textContent = `${I18n.t('claim_tn')} ${amount}`;
        }
        return;
      }

      // Success — reset claimable
      data.claimableTN = 0;
      save();
      // Sync reset to Firebase
      if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
        FirebaseAuth.syncTN(0);
      }

      // Update UI
      document.getElementById('profileClaimableTN').textContent = '0 TN';
      const balEl = document.getElementById('walletBalance');
      if (balEl) balEl.textContent = '0 TN claimable';

      if (claimBtn) {
        claimBtn.textContent = '✓ ' + I18n.t('claimed');
        claimBtn.disabled = true;
      }

      await refreshBalance();
      updateWalletUI();

      showToast(`${amount} TN minted to your wallet!`, 'success');

    } catch (e) {
      console.error('[Claim] Failed:', e);

      // Restore button
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtn.textContent = `${I18n.t('claim_tn')} ${amount}`;
      }

      if (e.message === 'NOT_BASE') {
        showToast(I18n.t('switch_to_base'), 'error');
      } else if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
        showToast(I18n.t('tx_cancelled'), 'info');
      } else if (e.message?.includes('execution reverted')) {
        showToast(I18n.t('tx_reverted'), 'error');
      } else {
        showToast(I18n.t('tx_failed') + ' ' + (e.reason || e.message || 'Unknown error'), 'error');
      }
    }
  }

  // ── Wire Events ─────────────────────────────────────────
  function init() {
    load();

    const openBtn = document.getElementById('profileBtn');
    if (openBtn) openBtn.onclick = openModal;

    const closeBtn = document.getElementById('profileCloseBtn');
    if (closeBtn) closeBtn.onclick = closeModal;

    const backdrop = document.getElementById('profileBackdrop');
    if (backdrop) backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };

    // Avatar click → toggle picker
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) avatarEl.onclick = () => {
      document.getElementById('avatarPicker').classList.toggle('hidden');
    };

    // Avatar picker selection
    const picker = document.getElementById('avatarPicker');
    if (picker) picker.addEventListener('click', (e) => {
      const opt = e.target.closest('.avatar-option');
      if (!opt) return;
      const emoji = opt.dataset.emoji;
      setAvatar(emoji);
      document.getElementById('profileAvatar').textContent = emoji;
      picker.querySelectorAll('.avatar-option').forEach(el =>
        el.classList.toggle('selected', el.dataset.emoji === emoji)
      );
      picker.classList.add('hidden');
    });

    // Name input
    const nameInput = document.getElementById('profileNameInput');
    if (nameInput) {
      nameInput.addEventListener('change', () => setName(nameInput.value));
      nameInput.addEventListener('blur',   () => setName(nameInput.value));
    }

    // Claim button
    const claimBtn = document.getElementById('profileClaimBtn');
    if (claimBtn) claimBtn.onclick = claimTN;

    // Character select modal
    const charBtn = document.getElementById('charBtn');
    if (charBtn) charBtn.onclick = openCharSelect;

    const charCloseBtn = document.getElementById('charCloseBtn');
    if (charCloseBtn) charCloseBtn.onclick = closeCharSelect;

    const charBackdrop = document.getElementById('charBackdrop');
    if (charBackdrop) charBackdrop.onclick = (e) => {
      if (e.target === charBackdrop) closeCharSelect();
    };

    // Connect wallet button inside profile modal
    const profileConnectBtn = document.getElementById('profileConnectBtn');
    if (profileConnectBtn) profileConnectBtn.onclick = async () => {
      if (typeof window.openWalletModal === 'function') {
        window.openWalletModal();
      } else {
        const ok = await connectWallet();
        if (ok) openModal(); // refresh modal with connected state
      }
    };
  }

  // ── Character Selection ────────────────────────────────────
  function getSelectedChar() {
    return CHARACTERS[data.selectedChar] || CHARACTERS.shadow;
  }

  function selectChar(charId) {
    if (!data.unlockedChars.includes(charId)) return false;
    data.selectedChar = charId;
    save();
    return true;
  }

  function isCharUnlocked(charId) {
    return data.unlockedChars.includes(charId);
  }

  async function unlockChar(charId) {
    const charDef = CHARACTERS[charId];
    if (!charDef || charDef.cost <= 0) return 'free';
    if (data.unlockedChars.includes(charId)) return 'already';

    const cost = charDef.cost;

    // ── Path A: Wallet connected → burn TN on-chain ──
    if (WalletState.connected && WalletState.contract) {
      try {
        const amountWei = ethers.utils.parseEther(cost.toString());

        // Check balance
        const rawBal = await WalletState.contract.balanceOf(WalletState.address);
        const bal    = Number(ethers.utils.formatEther(rawBal));
        if (bal < cost) {
          showToast(`${I18n.t('not_enough_tn')} ${Math.floor(bal)} TN.`, 'error');
          return 'insufficient';
        }

        showToast(I18n.t('confirm_burn'), 'info');
        const tx = await WalletState.contract.burn(amountWei, { gasLimit: 100000 });
        showToast(I18n.t('burning_tn'), 'info');
        await tx.wait();

        data.unlockedChars.push(charId);
        data.selectedChar = charId;
        save();
        await refreshBalance();
        showToast(`${charDef.name} ${I18n.t('unlocked')} 🔓`, 'success');
        return 'ok';

      } catch (e) {
        console.error('[Unlock] Burn failed:', e);
        if (e.code === 4001 || e.code === 'ACTION_REJECTED') {
          showToast(I18n.t('tx_cancelled'), 'info');
          return 'cancelled';
        }
        showToast(I18n.t('burn_failed') + ' ' + (e.reason || e.message || ''), 'error');
        return 'error';
      }
    }

    // ── Path B: No wallet → deduct from claimableTN ──
    if (data.claimableTN < cost) {
      showToast(`${I18n.t('need_tn')} ${cost} TN! ${I18n.t('not_enough_tn')} ${data.claimableTN} TN.`, 'error');
      return 'insufficient';
    }

    data.claimableTN -= cost;
    data.unlockedChars.push(charId);
    data.selectedChar = charId;
    save();

    // Sync to Firebase
    if (typeof FirebaseAuth !== 'undefined' && FirebaseAuth.isSignedIn()) {
      FirebaseAuth.syncTN(data.claimableTN);
    }

    updateWalletUI();
    showToast(`${charDef.name} ${I18n.t('unlocked')} 🔓`, 'success');
    return 'ok';
  }

  // ── Character Select Modal ───────────────────────────────
  function openCharSelect() {
    const backdrop = document.getElementById('charBackdrop');
    if (!backdrop) return;
    renderCharCards();
    backdrop.classList.remove('hidden');
  }

  function closeCharSelect() {
    const backdrop = document.getElementById('charBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
  }

  function renderCharCards() {
    const grid = document.getElementById('charGrid');
    if (!grid) return;

    grid.innerHTML = '';
    for (const [id, char] of Object.entries(CHARACTERS)) {
      const unlocked = data.unlockedChars.includes(id);
      const selected = data.selectedChar === id;
      const card = document.createElement('div');
      card.className = 'char-card' + (selected ? ' selected' : '') + (!unlocked ? ' locked' : '');
      card.dataset.char = id;
      card.style.borderColor = char.color;

      card.innerHTML = `
        <div class="char-emoji">${char.emoji}</div>
        <div class="char-name" style="color:${char.color}">${char.name}</div>
        <div class="char-desc">${char.descKey ? I18n.t(char.descKey) : char.description}</div>
        <div class="char-abilities">
          <span class="char-tag" style="border-color:${char.color}">
            ${char.bulletBounce ? '↩️ ' + I18n.t('bounce_tag') : '💥 ' + I18n.t('spread_tag')}
          </span>
          <span class="char-tag" style="border-color:${char.color}">
            ${char.ultType === 'heal' ? '💚 ' + I18n.t('heal_tag') : '⚡ ' + I18n.t('explosion_tag')}
          </span>
        </div>
        ${unlocked
          ? `<button class="btn btn-sm char-btn" style="border-color:${char.color};color:${char.color}">
               ${selected ? '✓ ' + I18n.t('selected') : I18n.t('select')}
             </button>`
          : `<button class="btn btn-sm btn-gold char-btn char-unlock-btn">
               🔒 ${I18n.t('unlock')} (${char.cost} TN)
             </button>`
        }
      `;

      // Button handler
      const btn = card.querySelector('.char-btn');
      if (unlocked && !selected) {
        btn.onclick = () => {
          selectChar(id);
          renderCharCards();
        };
      } else if (!unlocked) {
        btn.onclick = async () => {
          btn.disabled = true;
          btn.textContent = '⏳...';
          const result = await unlockChar(id);
          if (result === 'ok') {
            renderCharCards();
          } else {
            btn.disabled = false;
            btn.textContent = `🔒 ${I18n.t('unlock')} (${char.cost} TN)`;
          }
        };
      }

      grid.appendChild(card);
    }
  }

  return {
    load, save, get, setAvatar, setName, updateStats,
    openModal, closeModal, init, claimTN, AVATARS,
    getSelectedChar, selectChar, isCharUnlocked, unlockChar,
    openCharSelect, closeCharSelect,
  };
})();

// ══════════════════════════════════════════════════════════════
// AUTO CONNECT
// ══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  // Init profile
  PlayerProfile.init();

  // Wire connect button (Web3Modal overrides this if loaded)
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) connectBtn.onclick = () => {
    if (typeof window.openWalletModal === 'function') {
      window.openWalletModal();
    } else {
      connectWallet();
    }
  };

  // Show TN balance immediately (even before wallet connect)
  updateWalletUI();

  // Restore address from storage
  const saved = localStorage.getItem('ninja_wallet');
  if (saved) window._walletAddr = saved;

  // Auto-reconnect if MetaMask already authorized
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts'
      });
      if (accounts.length > 0) {
        await connectWallet();
      }
    } catch (e) { /* silent */ }
  }
});