# PolkaStream

**The first native stablecoin streaming payments protocol on Polkadot Hub EVM**

Built for **Polkadot Solidity Hackathon 2026** (Track 1 – EVM Smart Contracts)

![GitHub](https://img.shields.io/badge/Track_1-EVM-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Hackathon](https://img.shields.io/badge/Hackathon-Polkadot_Solidity_2026-orange)

## 🚀 One-Line Pitch
PolkaStream brings **real-time streaming payments** to Polkadot — pay salaries, subscriptions, or DAO rewards **per second**. Lock stablecoins upfront, withdraw anytime, pause/cancel instantly, and get **atomic XCM cross-chain notifications**. Zero competitors in the hackathon. Production-ready. Pure Polkadot native.

## 🎯 Problem
Polkadot has great stablecoins (ReviveUSD, etc.), but traditional transfers are **one-time only**.  
Freelancers wait until month-end for salary.  
DAOs manually send recurring rewards.  
Subscriptions get delayed or disputed.  

Existing solutions (Sablier, etc.) live on Ethereum — high gas, complicated cross-chain.

## ✅ Solution
A fully decentralized streaming payments dApp on **Polkadot Hub EVM** (pallet-revive):

- Create a stream with **Cliff** (delayed start)
- Recipient withdraws **real-time accrued amount** anytime
- Pause / Resume / Cancel with instant refund
- **Atomic XCM precompile call** after every withdrawal (cross-chain notification to Moonbeam/Astar)
- Multi-token support (ReviveUSD + test USDC + DOT)
- No bridge, no wrapped tokens — 100% Polkadot native

## ✨ Key Features
- Cliff delay support
- Real-time `getOwed()` calculation
- Pause / Resume streams
- Atomic XCM cross-chain notification (precompile 0xA0000)
- ReentrancyGuard + SafeERC20 security
- Beautiful real-time dashboard with progress bars
- SubWallet + MetaMask dual wallet support

## 🛠 Tech Stack
- **Smart Contract**: Solidity 0.8.20 + Foundry + OpenZeppelin
- **Frontend**: Next.js 14 + viem + Tailwind CSS
- **Wallet**: SubWallet + MetaMask
- **Network**: Polkadot Hub TestNet (Chain ID: 420420417)
- **Deployment**: pallet-revive EVM + XCM precompile

## 📹 Demo Video (3 minutes)
Watch how it works:  
[Watch Demo on YouTube](https://youtu.be/YOUR-LINK) 

**Demo flow**:  
1. Create stream with 30-day Cliff  
2. Fast-forward time  
3. Recipient clicks Withdraw → money arrives instantly  
4. XCM cross-chain notification popup appears  

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/konodiongdi ongda-beep/PolkaStream.git
cd PolkaStream

# 2. Contracts
cd contracts
forge install
forge test
forge script script/Deploy.s.sol --rpc-url https://services.polkadothub-rpc.com/testnet --broadcast

# 3. Frontend
cd ../frontend
pnpm install
pnpm dev
