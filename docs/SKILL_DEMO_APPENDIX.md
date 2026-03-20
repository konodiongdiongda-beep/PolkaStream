# Skill / MCP Demo Appendix

Last updated: `2026-03-20`

This appendix is for optional recording only.
Do not put it into the main public submission video unless the latest contract stack is publicly re-verified.

## 1. Recommended Use

Use this appendix only when you want to prove:
- the repository includes a real agent integration surface
- business actions are mapped into MCP tools
- PolkaStream is not only a frontend demo

## 2. Two Recording Modes

### Mode A: Safe proof clip
Use when you want a low-risk appendix.

What to show:
1. `services/agent-mcp/README.md`
2. tool families in `docs/AGENT_MCP_SKILL_ADAPTER.md`
3. `pnpm -C services/agent-mcp smoke`

What this proves:
- MCP server exists
- package runs
- tool surface is implemented

What this does not prove:
- live commercial flow on the public deployment

### Mode B: Strong live appendix
Use only if these are ready first:
- latest commercial contract stack deployed
- `SERVICE_PLAN_REGISTRY_ADDRESS` configured
- API / BFF running
- MCP env configured with wallet and API auth

What to show:
1. `get_provider_plans`
2. `get_service_plan`
3. `get_token_allowance`
4. `approve_token_spend`
5. `create_pending_stream_from_plan`
6. `get_stream_commercial_state`
7. optional:
   - `upsert_service_trigger`
   - `trigger_service`
   - `post_usage_events`
   - `preview_settlement`

## 3. Appendix Operator Script

### Safe proof clip

Shot order:
1. open `services/agent-mcp/README.md`
2. pause on the recommended flows section
3. open `docs/AGENT_MCP_SKILL_ADAPTER.md`
4. pause on the tool surface section
5. run:

```bash
pnpm -C services/agent-mcp smoke
```

6. end on the MCP package manifest or tool list

Voiceover:
- `Beyond the public demo surface, PolkaStream also includes an MCP adapter for agent-native execution.`
- `This maps business actions like plan discovery, token approval, stream funding, activation, and settlement into a callable tool surface.`
- `So the repository supports not only a frontend console, but also a real integration path for agents.`

### Strong live appendix

Shot order:
1. open MCP host or tool client
2. call `get_provider_plans`
3. call `get_service_plan`
4. call `get_token_allowance`
5. call `approve_token_spend`
6. call `create_pending_stream_from_plan`
7. call `get_stream_commercial_state`

Voiceover:
- `This appendix shows the agent-native integration path.`
- `Instead of reasoning about raw ABI calls, the agent works through a business-level MCP surface.`
- `That is how PolkaStream can support provider plans, pending funding, and operator-triggered service flows.`

## 4. Exact Terminal Commands for Safe Appendix

```bash
pnpm -C services/agent-mcp smoke
sed -n '1,180p' services/agent-mcp/README.md
sed -n '1,220p' docs/AGENT_MCP_SKILL_ADAPTER.md
```

## 5. Inclusion Rule

If you are uncertain, do this:
- main video: no skill clip
- demo day or private follow-up: add skill appendix

That is the safer judging strategy.
