# Submission Copy

This file is the source of truth for hackathon submission text.

## 1. Project Name

`PolkaStream`

## 2. One-Line Description

PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM, with AI Agent Settlement as its flagship demo scenario.

## 3. Short Description

PolkaStream lets a payer lock budget once and release value continuously onchain. It supports per-second settlement, stream lifecycle controls, retryable notifier failures, and an optional batched settlement sidecar for AI usage.

## 4. Submission Card Summary

PolkaStream brings streaming payments to Polkadot Hub EVM. Users can create stablecoin streams, withdraw in real time, pause, resume, cancel, and recover failed notify flows. AI Agent Settlement is the flagship demo scenario, while request-level batched settlement remains an optional extension.

## 5. Full Description

### Problem

Many digital services have already become real-time and usage-based, but payments still depend on upfront transfers, one-off payouts, or manual reconciliation. That mismatch is especially visible in AI services, where agents may need to pay for API calls, compute, or other digital resources continuously rather than in coarse manual steps.

### Solution

PolkaStream solves this with onchain streaming payments on Polkadot Hub EVM. A payer locks budget upfront, value unlocks linearly over time, and the receiver can withdraw against live onchain state. The payment flow becomes programmable, verifiable, and traceable.

### What is live today

PolkaStream is live on Polkadot Hub Testnet with:
- a deployed `PolkaStream.sol` contract
- a working frontend console
- core stream actions wired end-to-end: `createStream`, `withdraw`, `pause`, `resume`, `cancel`, `retryNotify`
- deployment evidence archived in the repo
- contract tests, invariant tests, and an internal security review

### Core protocol features

- `Cliff + linear per-second release`
- `withdraw / pause / resume / cancel`
- `multi-token allowlist`
- `governance-controlled parameters`
- `retryable notifier failure handling`
- `strictXcm` mode for stronger consistency when needed

### Flagship scenario: AI Agent Settlement

Our strongest demo scenario is AI Agent Settlement. Instead of making a manual payment for every operation, an AI agent can create or fund a payment flow once and settle value continuously as service usage happens.

### Optional extension: request-level batched settlement sidecar

Beyond the streaming core, we also implemented a request-level batched settlement sidecar:
- usage events are normalized offchain
- events are aggregated into settlement windows
- a sidecar contract settles the window onchain
- providers can claim from the resulting balance

This extension exists to show how PolkaStream can support high-frequency AI usage without making each request an onchain transaction. It is an extension, not the main protocol story.

### Why Polkadot Hub EVM

Polkadot Hub EVM gives us a clean environment for programmable onchain payments, testnet deployment, and precompile-aware integrations. It is a strong fit for a payment rail that needs both smart contract clarity and composable infrastructure.

## 6. How It Was Built

- Smart contracts: Solidity + Foundry
- Frontend console: React + Vite + viem
- Sidecar flow: Node.js adapter + settlement daemon + HTTP API
- Verification: Forge tests, invariant tests, frontend build checks, deployment evidence, internal security review

## 7. Current Status

Use this wording in forms and judging conversations:
- `Live on Polkadot Hub Testnet`
- `Deployment evidence archived`
- `Internal security review completed`
- `Demo-ready prototype`

Do not use this wording:
- `Mainnet live`
- `Fully audited`
- `Production-ready`

## 8. Public Links

- Repo: [github.com/konodiongdiongda-beep/PolkaStream](https://github.com/konodiongdiongda-beep/PolkaStream)
- Live console: [polkastream-console.vercel.app](https://polkastream-console.vercel.app)
- Deployment evidence: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)
- Security review: [`docs/SECURITY_REVIEW.md`](SECURITY_REVIEW.md)

## 9. Very Short Variants

### 120 characters

Streaming payments on Polkadot Hub EVM, with AI Agent Settlement as the flagship demo scenario.

### 240 characters

PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM. It supports per-second settlement, lifecycle controls, retryable notifier failures, and an optional batched settlement sidecar for AI usage.
