# Final Materials Pack

Last updated: `2026-03-20`

This file is the final coordination pack for submission, recording, voiceover, and judge Q&A.

## 1. Submission-Safe Positioning

Use this order everywhere:
1. `Core`: streaming payments
2. `Flagship scenario`: AI Agent Settlement
3. `Optional extension`: request-level batched settlement sidecar

Safe external line:
- `PolkaStream is a stablecoin streaming payments protocol on Polkadot Hub EVM, with AI Agent Settlement as the flagship demo scenario.`

## 2. Truth Boundary

### Publicly verifiable now
- `PolkaStream` core contract deployed on Polkadot Hub Testnet
- live frontend console
- stream lifecycle demoable on the public deployment:
  - `createStream`
  - `withdraw`
  - `pause`
  - `resume`
  - `cancel`
  - `retryNotify`
- deployment evidence archived in repo
- internal security review documented
- AI settlement sidecar documented and surfaced in console

### Implemented in code, but do not put into the main public submission video unless re-deployed and re-verified
- `Pending Stream`
- `activateStream`
- `ServicePlan`
- provider-set commercial plan flow
- MCP / skill-driven commercial stream operations tied to the latest contract surface

Reason:
- the current public deployment evidence is still anchored to the 2026-03-09 core contract release
- the public testnet address in `docs/DEPLOYMENT.md` does not currently provide public-safe proof for the newer `ServicePlan` surface

## 3. Final Asset Set

### Ready
- Submission copy: [`docs/SUBMISSION_COPY.md`](SUBMISSION_COPY.md)
- Pitch deck copy: [`docs/PITCH_DECK_FULL.md`](PITCH_DECK_FULL.md)
- Demo video script: [`docs/DEMO_VIDEO_SCRIPT.md`](DEMO_VIDEO_SCRIPT.md)
- Final demo video master: [`output/final-video/polkastream-submission-2026-03-20.mp4`](../output/final-video/polkastream-submission-2026-03-20.mp4)
- Judge Q&A pack: [`docs/JUDGE_QA_PACK.md`](JUDGE_QA_PACK.md)
- Deployment proof: [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)
- Security review: [`docs/SECURITY_REVIEW.md`](SECURITY_REVIEW.md)
- Submission coordinator: [`docs/HACKATHON_SUBMISSION.md`](HACKATHON_SUBMISSION.md)

### Still manual
- export deck PDF
- upload final public video
- paste final links into DoraHacks form

## 4. Recommended Video Strategy

### Main submission video
Use the public-safe version only:
1. live console first
2. create stream in `Immediate` mode
3. show `Streams`
4. show `Withdraw`
5. show `Retry Notify`
6. briefly show `AI Settlements`
7. end on deployment evidence and live product

### Optional appendix clip
Only record this if you first re-verify the latest deployment:
1. `Pending Stream`
2. `ServicePlan`
3. skill / MCP flow

Do not merge the appendix into the main public submission video unless the latest contract stack is also publicly verifiable.

## 5. MiniMax Voiceover Package

Use [`docs/DEMO_VIDEO_SCRIPT.md`](DEMO_VIDEO_SCRIPT.md) as the source.

Recommended workflow:
1. Use the `Main voiceover script` section directly in MiniMax.
2. Generate one clean English narration track.
3. Record screen separately without speaking.
4. Sync the narration to the operator timeline.
5. Add only short subtitles, not full transcripts.

## 6. Skill / MCP Demo Plan

### Safe recommendation
- keep skill / MCP out of the main submission video
- mention it only in Q&A or as an appendix clip

### Appendix path if you want the extra proof
Preconditions:
- latest contract stack deployed and verified
- `SERVICE_PLAN_REGISTRY_ADDRESS` configured
- API / BFF running
- MCP env configured

Recommended tool sequence:
1. `get_provider_plans`
2. `get_service_plan`
3. `get_token_allowance`
4. `approve_token_spend`
5. `create_pending_stream_from_plan`
6. `get_stream_commercial_state`
7. optional service path:
   - `upsert_service_trigger`
   - `trigger_service`
   - `post_usage_events`
   - `preview_settlement`

### What this appendix proves
- PolkaStream is not only a UI demo
- an agent-native integration surface exists
- business actions are already mapped into MCP tools

## 7. Exact Wording to Keep

Use:
- `Live on Polkadot Hub Testnet`
- `Deployment evidence archived`
- `Internal security review completed`
- `Demo-ready prototype`

Avoid:
- `mainnet live`
- `fully audited`
- `production-ready`
- `AI payments protocol` as the primary identity

## 8. Tonight's Execution Order

1. lock description from [`docs/SUBMISSION_COPY.md`](SUBMISSION_COPY.md)
2. build the final deck from [`docs/PITCH_DECK_FULL.md`](PITCH_DECK_FULL.md)
3. upload the public-safe video master from [`output/final-video/polkastream-submission-2026-03-20.mp4`](../output/final-video/polkastream-submission-2026-03-20.mp4)
4. review likely judge questions from [`docs/JUDGE_QA_PACK.md`](JUDGE_QA_PACK.md)
5. paste links into the submission form
6. final proofread before submit
