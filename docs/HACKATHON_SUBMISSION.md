# Hackathon Submission Package

Last updated: `2026-03-20`

## 1. Official References

- Hackathon homepage: [polkadothackathon.com](https://polkadothackathon.com/)
- Public repo: [github.com/konodiongdiongda-beep/PolkaStream](https://github.com/konodiongdiongda-beep/PolkaStream)
- Live console: [polkastream-console.vercel.app](https://polkastream-console.vercel.app)

Key official timing currently shown on the hackathon site:
- Project submission deadline: `2026-03-20`
- Demo Day: `2026-03-24` to `2026-03-25`

Practical rule:
- Treat `2026-03-19` as the internal final deadline.
- Do not rely on an unspecified timezone or last-minute submission window.

## 2. What We Are Submitting

External framing must stay in this order:
1. Core: `streaming payments`
2. Flagship scenario: `AI Agent Settlement`
3. Optional extension: `request-level batched settlement sidecar`

Safe external claim:
- `PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM, with AI Agent Settlement as the flagship demo scenario.`

Claims to avoid:
- `mainnet`
- `fully audited`
- `production-ready`
- `generic AI payments protocol`

## 3. Submission Asset Checklist

### Hard requirements
- `GitHub repository (open source)`: ready
- `Project description`: ready via [`docs/SUBMISSION_COPY.md`](SUBMISSION_COPY.md)
- `Demo video (1-3 minutes)`: master file ready via [`output/final-video/polkastream-submission-2026-03-20.mp4`](../output/final-video/polkastream-submission-2026-03-20.mp4), final upload still required

### Recommended for winning
- `Pitch deck`: full copy ready via [`docs/PITCH_DECK_FULL.md`](PITCH_DECK_FULL.md), export still required
- `Demo Day speaking pack`: use submission copy + video script + deployment evidence together
- `Judge Q&A pack`: ready via [`docs/JUDGE_QA_PACK.md`](JUDGE_QA_PACK.md)
- `Final materials pack`: ready via [`docs/FINAL_MATERIALS_PACK.md`](FINAL_MATERIALS_PACK.md)
- `Skill appendix`: ready via [`docs/SKILL_DEMO_APPENDIX.md`](SKILL_DEMO_APPENDIX.md)

## 4. Current Evidence Package

- Repo entry: [`README.md`](../README.md)
- Deployment evidence: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)
- Release and rollback notes: [`docs/RELEASE_GATE_V2.md`](RELEASE_GATE_V2.md)
- Security review: [`docs/SECURITY_REVIEW.md`](SECURITY_REVIEW.md)
- Security and ops model: [`docs/SECURITY.md`](SECURITY.md)
- AI settlement sidecar architecture: [`docs/ARCH_AI_SETTLEMENT.md`](ARCH_AI_SETTLEMENT.md)
- Task and readiness status: [`TASKS.md`](../TASKS.md)

## 5. Submission Status Snapshot

### Ready now
- Core protocol repo structure is coherent.
- Testnet deployment evidence is archived.
- Frontend console is live.
- Contract tests, invariant tests, and frontend build gate pass.
- Sidecar architecture and service flow are documented.

### Still manual tonight
- Upload the final public demo video master [`output/final-video/polkastream-submission-2026-03-20.mp4`](../output/final-video/polkastream-submission-2026-03-20.mp4) and paste the real link into the submission form.
- Keep the main public video on the currently verifiable streaming core; only use ServicePlan / MCP appendix clips after redeploy + re-verification.
- Export one pitch deck PDF.
- Make sure the DoraHacks form copy matches [`docs/SUBMISSION_COPY.md`](SUBMISSION_COPY.md) exactly.
- Reconfirm the selected track in the submission form before clicking submit.

## 6. Best Submission Order Tonight

1. Lock the final description from [`docs/SUBMISSION_COPY.md`](SUBMISSION_COPY.md).
2. Upload the final `1-3 minute` demo video master from [`output/final-video/polkastream-submission-2026-03-20.mp4`](../output/final-video/polkastream-submission-2026-03-20.mp4).
3. Export the pitch deck from [`docs/PITCH_DECK_FULL.md`](PITCH_DECK_FULL.md).
4. Fill the submission form.
5. Open the public repo and verify all linked docs render correctly on GitHub.

## 7. Truthful Current Status

Use this wording when asked about maturity:
- `Live on Polkadot Hub Testnet`
- `Deployment evidence archived`
- `Internal security review completed`
- `Demo-ready prototype`

Do not upgrade that wording unless T33-T48 in [`TASKS.md`](../TASKS.md) are actually closed.
