# PolkaStream Agent Guide

This file is for internal collaboration only.

It exists to help AI agents, automation workflows, and future contributors work on this repo without drifting away from the actual project scope or over-claiming what is live today.

## 1. Project Identity

PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM.

The correct project framing is:

1. Core: `streaming payments`
2. Flagship scenario: `AI Agent Settlement`
3. Optional extension: `request-level batched settlement sidecar`

Do not invert this order in docs, demos, or code comments unless a task explicitly requires it.

## 2. External Narrative Guardrails

When writing public-facing content, keep these rules:

1. Do not describe PolkaStream as a generic `AI payments protocol`.
2. Do not make the sidecar the headline.
3. Do not say `mainnet`, `fully audited`, or `production-ready`.
4. Preferred wording:
   - `live on Polkadot Hub Testnet`
   - `internal security review completed`
   - `demo-ready prototype with deployment evidence`

Recommended narrative order:

1. Continuous digital services need better payment rails.
2. PolkaStream provides onchain streaming payments.
3. AI Agent Settlement is the strongest example.
4. Batched settlement sidecar exists as an extension.

## 3. What Is Actually Live

These are the live, defensible claims today:

1. `PolkaStream.sol` is deployed on `polkadot-hub-testnet`.
2. Frontend console is deployed and accessible.
3. Core stream actions are integrated in the frontend:
   - `createStream`
   - `withdraw`
   - `pause`
   - `resume`
   - `cancel`
   - `retryNotify`
4. Deployment evidence is archived in docs.
5. Contract tests, invariant tests, and internal security review are completed.

## 4. What Exists But Is Not the Main Demo

The following is implemented, but should be presented as an extension:

1. `UsageSettlementHub.sol`
2. `services/adapter/openclaw_adapter.mjs`
3. `services/settlement-daemon/settlement_daemon.mjs`
4. `docs/ARCH_AI_SETTLEMENT.md`

Correct description:

`request-level batched settlement sidecar for AI usage`

Incorrect description:

`the main live product flow`

## 5. Source of Truth

Use these files first before making claims:

1. `README.md`
2. `docs/DEPLOYMENT.md`
3. `docs/SECURITY_REVIEW.md`
4. `docs/SECURITY.md`
5. `docs/ARCH_AI_SETTLEMENT.md`
6. `TASKS.md`

If external messaging conflicts with these files, update the messaging first, not the facts.

## 6. Frontend Positioning Rules

When editing frontend copy:

1. Primary headline should stay close to `stablecoin streaming payments`.
2. AI language should appear as the main use case, not the product category.
3. `AI Settlements` or similar pages should be framed as a supporting or extension view unless the underlying interaction is truly sidecar-native.
4. Judge flow should prioritize:
   - connect wallet
   - create stream
   - show claimable / withdraw
   - retry notify if needed

## 7. Technical Boundaries

Core protocol responsibilities:

1. budget locking
2. per-second linear release
3. receiver withdrawal
4. stream lifecycle controls
5. allowlist and governance
6. notifier failure handling and retry

Sidecar responsibilities:

1. request-level usage normalization
2. window aggregation
3. batched onchain settlement
4. replay protection
5. provider claim after batch settlement

Do not merge these responsibilities in public explanations unless the user explicitly wants a deeper architecture walkthrough.

## 8. Skills / OpenSpec / Internal Workflow

If contributors use skills, OpenSpec, OPSX, or AI workflow helpers:

1. treat them as internal execution tools
2. do not present them as product features
3. do not let them change external positioning
4. keep public docs focused on protocol, demo, deployment, and verification

It is acceptable to document AI workflow or spec tooling internally, but not as part of the project's user-facing value proposition.

## 9. Safe Default Writing Pattern

When unsure, use this pattern:

1. `PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM.`
2. `AI Agent Settlement is the flagship demo scenario.`
3. `An optional batched settlement sidecar is also implemented for request-level usage.`

## 10. Avoid These Mistakes

1. overselling the sidecar
2. calling testnet deployment production
3. treating internal automation as product capability
4. describing AI as the entire product instead of the strongest scenario
5. claiming external audits or live business usage without evidence
