/* ============================================================
   web3modal.js — Reown AppKit (Web3Modal) Integration
   Provides multi-wallet connect: MetaMask, WalletConnect,
   Coinbase Wallet, Trust Wallet, and 300+ wallets.
   ============================================================
   SETUP:
   1. Go to https://cloud.reown.com (or https://dashboard.reown.com)
   2. Create a free project
   3. Copy your Project ID
   4. Paste it below in PROJECT_ID
   ============================================================ */

import {
  createAppKit,
  WagmiAdapter,
  networks,
} from 'https://cdn.jsdelivr.net/npm/@reown/appkit-cdn@1.6.8/dist/appkit.js';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION — Replace with your Project ID!
// ═══════════════════════════════════════════════════════════════
const PROJECT_ID = 'YOUR_PROJECT_ID'; // ← PASTE YOUR ID HERE

// Base network definition (fallback if networks.base doesn't exist)
const baseNetwork = (networks && networks.base) || {
  id:              8453,
  name:            'Base',
  nativeCurrency:  { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls:         { default: { http: ['https://mainnet.base.org'] } },
  blockExplorers:  { default: { name: 'BaseScan', url: 'https://basescan.org' } },
};

// ═══════════════════════════════════════════════════════════════
// INIT AppKit
// ═══════════════════════════════════════════════════════════════
let modal = null;

try {
  const wagmiAdapter = new WagmiAdapter({
    networks:  [baseNetwork],
    projectId: PROJECT_ID,
  });

  modal = createAppKit({
    adapters:  [wagmiAdapter],
    networks:  [baseNetwork],
    projectId: PROJECT_ID,
    metadata: {
      name:        'Ninja Brawl',
      description: 'Ninja Brawl — Fight & Earn NinjaCoin',
      url:         window.location.origin,
      icons:       [],
    },
    features: {
      analytics: false,
    },
  });

  console.log('[Web3Modal] AppKit initialized');
} catch (e) {
  console.error('[Web3Modal] Init failed:', e);
}

// ═══════════════════════════════════════════════════════════════
// EXPOSE — Let existing code open the modal
// ═══════════════════════════════════════════════════════════════
window.openWalletModal = () => {
  if (modal) {
    modal.open();
  } else {
    // Fallback to direct MetaMask if AppKit failed
    if (typeof connectWallet === 'function') connectWallet();
  }
};

// ═══════════════════════════════════════════════════════════════
// BRIDGE — Sync AppKit connection → WalletState (ethers.js v5)
// ═══════════════════════════════════════════════════════════════
if (modal) {

  // ── Provider subscription ──────────────────────────────────
  modal.subscribeProviders(async (providers) => {
    const rawProvider = providers?.eip155;
    if (!rawProvider) return;

    try {
      // Create ethers v5 provider + signer
      const provider = new ethers.providers.Web3Provider(rawProvider);
      const signer   = provider.getSigner();
      const address  = await signer.getAddress();

      // Verify Base network (chainId 8453)
      const network = await provider.getNetwork();
      if (network.chainId !== 8453) {
        console.warn('[Web3Modal] Not on Base. chainId:', network.chainId);
        // Still connect — user can switch via the modal network selector
      }

      // Bridge to existing WalletState
      window.WalletState.provider  = provider;
      window.WalletState.signer    = signer;
      window.WalletState.address   = address;
      window.WalletState.connected = true;

      // Contract instance
      if (typeof NINJA_CONTRACT_ADDR !== 'undefined' && typeof NINJA_ABI !== 'undefined') {
        window.WalletState.contract = new ethers.Contract(
          NINJA_CONTRACT_ADDR,
          NINJA_ABI,
          signer
        );
      }

      window._walletAddr = address;
      localStorage.setItem('ninja_wallet', address);

      // Refresh balance + UI
      if (typeof refreshBalance === 'function') await refreshBalance();
      if (typeof updateWalletUI === 'function') updateWalletUI();
      if (typeof showToast === 'function') showToast('Wallet connected! 🥷', 'success');

      console.log('[Web3Modal] Connected:', address);
    } catch (e) {
      console.error('[Web3Modal] Provider bridge error:', e);
    }
  });

  // ── Account subscription (handle disconnect) ───────────────
  modal.subscribeAccount((account) => {
    if (!account.isConnected) {
      window.WalletState.connected = false;
      window.WalletState.address   = null;
      window.WalletState.provider  = null;
      window.WalletState.signer    = null;
      window.WalletState.contract  = null;
      window._walletAddr = null;
      localStorage.removeItem('ninja_wallet');

      if (typeof updateWalletUI === 'function') updateWalletUI();
      console.log('[Web3Modal] Disconnected');
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// WIRE BUTTONS — Override connect buttons to use AppKit
// ═══════════════════════════════════════════════════════════════
// Module scripts run after regular scripts (deferred), so DOM is ready
const connectBtn        = document.getElementById('connectBtn');
const profileConnectBtn = document.getElementById('profileConnectBtn');

if (connectBtn) {
  connectBtn.onclick = (e) => {
    e.preventDefault();
    window.openWalletModal();
  };
}

if (profileConnectBtn) {
  profileConnectBtn.onclick = (e) => {
    e.preventDefault();
    window.openWalletModal();
  };
}
