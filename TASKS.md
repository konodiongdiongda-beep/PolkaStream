# PolkaStream 改造执行清单

更新时间：2026-03-20（新增 Agent Integration / MCP Adapter / ServicePlan 落地进展，并完成提交版演示视频母版）  
目标：将当前项目从 Hackathon Demo 提升为可上线的协议原型。  
使用方式：每个任务认领后填写 `Owner`，执行中更新 `Status`，完成后按 `验收标准` 自检并附 PR 链接。

## 状态定义
- `TODO`：未开始
- `DOING`：进行中
- `BLOCKED`：受阻
- `DONE`：完成并通过验收

## 优先级与执行顺序
建议顺序（下一阶段）：`T33 -> T34 -> T35 -> T36 -> T37 -> T38 -> T39 -> T40 -> T41 -> T42 -> T43 -> T44 -> T45 -> T46 -> T47 -> T48`

## 任务列表

| ID | Priority | 任务 | 主要文件 | 验收标准 | Depends On | Owner | Status |
|---|---|---|---|---|---|---|---|
| T01 | P0 | 重构 `withdraw`：XCM 通知失败不再默认回滚提款；增加 `strictXcm` 开关（默认 `false`） | `contracts/PolkaStream.sol` | `withdraw` 在 notifier 失败时仍可转账成功；`strictXcm=true` 时恢复强一致回滚；新增事件可追踪通知失败 | - | Codex | ✅ DONE |
| T02 | P0 | 新增 `IXcmNotifier` 适配层，移除主合约对 `0xA0000` 的硬编码依赖 | `contracts/PolkaStream.sol`，`contracts/interfaces/IXcmNotifier.sol` | notifier 地址可配置；主合约仅调用接口；不修改既有资金状态机语义 | T01 | Codex | ✅ DONE |
| T03 | P0 | 增加通知补偿机制：`retryNotify(streamId, withdrawId)` + `NotifyStatus` | `contracts/PolkaStream.sol` | 失败通知可重试；重试幂等；可通过事件和 getter 查询状态 | T02 | Codex | ✅ DONE |
| T04 | P0 | 引入治理权限：`Ownable2Step`，敏感参数仅治理可改 | `contracts/PolkaStream.sol` | `notifier/strictXcm/tokenAllowlist` 等参数具备访问控制；权限变更有事件 | T02 | Codex | ✅ DONE |
| T05 | P0 | 参数与资产安全边界：token allowlist、`maxDuration`、`maxDepositPerStream` | `contracts/PolkaStream.sol` | 非白名单 token 无法创建；超范围参数交易回滚并给出明确错误 | T04 | Codex | ✅ DONE |
| T06 | P0 | 部署前健康检查：脚本探测 notifier/precompile 可用性，不通过即阻断 | `script/Deploy.s.sol`，新增 `script/HealthCheck.s.sol` | 部署命令在依赖异常时失败退出并输出可读原因 | T02 | Codex | ✅ DONE |
| T07 | P1 | 补齐单测与异常路径，目标分支覆盖率 >= 80% | `test/PolkaStream.t.sol` | `forge test` 全绿；`forge coverage` 中 `contracts/PolkaStream.sol` 分支覆盖率 >= 80% | T01,T02,T05 | Codex | ✅ DONE |
| T08 | P1 | 增加不变量测试：资金守恒 `withdrawn + refunded + contractBalance == deposit` | `test/PolkaStream.t.sol` | Fuzz/Invariant 运行稳定通过；无资金守恒破坏用例 | T07 | Codex | ✅ DONE |
| T09 | P1 | 前端交易前置检查：链 ID、合约地址、notifier 健康、token 是否可用 | `frontend/app/page.tsx`，`frontend/lib/viem.ts` | 不满足条件时按钮禁用且提示明确；避免用户发起必失败交易 | T05,T06 | Codex | ✅ DONE |
| T10 | P1 | 前端错误分层：用户提示与开发调试信息分离 | `frontend/app/page.tsx` | 用户只见可执行提示；控制台保留技术细节；不泄露原始异常堆栈到 UI | T09 | Codex | ✅ DONE |
| T11 | P1 | 数据读取优化：从高频全量轮询改为事件增量 + 分页 | `frontend/app/page.tsx` | 流数量上升时页面响应可接受；RPC 调用次数显著下降 | T09 | Codex | ✅ DONE |
| T12 | P1 | 建立 CI 质量门禁（合约测试、覆盖率、前端构建、静态检查） | `.github/workflows/*.yml`，`foundry.toml`，`frontend/package.json` | PR 自动跑检查；任一失败阻止合并 | T07 | Codex | ✅ DONE |
| T13 | P2 | 仓库治理：统一包管理器、清理多余锁文件与构建产物风险 | `frontend/package.json`，`.gitignore` | 仅保留一种包管理流程；`node_modules/.next/out/cache` 不入库 | T12 | Codex | ✅ DONE |
| T14 | P2 | 补充协议文档：威胁模型、失败恢复、治理流程 | `README.md`，新增 `docs/SECURITY.md`（可选） | 新成员可按文档完成部署、排障与应急处理 | T01,T04,T06 | Codex | ✅ DONE |
| T15 | P2 | 建立运行看板：创建数、提款成功率、通知失败率、重试成功率 | 新增 `docs/METRICS.md`（可选）或监控脚本目录 | 可周度追踪真实使用与可靠性指标，并支持导出复盘 | T03,T11 | Codex | ✅ DONE |
| T16 | P1 | 修复 CI 可重复性：`pnpm typecheck` 在干净环境稳定通过 | `.github/workflows/ci.yml`，`frontend/tsconfig.json`，`frontend/package.json` | 在全新 checkout 下执行 `pnpm lint && pnpm typecheck && pnpm build` 全通过；不依赖预先存在的 `.next/types` | T12 | Codex | ✅ DONE |
| T17 | P1 | 完成新版本链上部署并切换前端到新合约地址 | `script/Deploy.s.sol`，`docs/deployment-artifacts/*`，`frontend/.env.local`，`.env.example` | `isNotifierHealthy/notifier/strictXcm` 链上可读不 revert；前端连接后前置检查全绿 | T06,T09 | Codex | ✅ DONE |
| T18 | P1 | 强化健康检查语义，避免“假健康” | `contracts/XcmPrecompileNotifier.sol`，`script/HealthCheck.s.sol`，`test/PolkaStream.t.sol` | 健康检查需能区分“地址存在但不可用”的 precompile；新增失败用例测试 | T06,T07 | Codex | ✅ DONE |
| T19 | P2 | 前端补偿闭环：展示通知失败记录并支持 `retryNotify` | `frontend/app/page.tsx`，`frontend/lib/viem.ts`，`frontend/components/StreamCard.tsx` | 可看到 `FAILED` 通知并一键重试；重试结果回显并更新状态 | T03,T11 | Codex | ✅ DONE |
| T20 | P2 | 补齐适配器与脚本测试覆盖（非核心文件） | `test/*`，`contracts/XcmPrecompileNotifier.sol`，`script/HealthCheck.s.sol` | 新增针对 notifier/healthcheck 的单测或仿真测试；关键分支被覆盖 | T18 | Codex | ✅ DONE |
| T21 | P1 | 固化前端 Typecheck 稳定性（消除 `.next/types` 偶发缺失导致的首跑失败） | `frontend/package.json`，`frontend/tsconfig.json`，`.github/workflows/ci.yml` | 在干净环境连续 3 次执行 `pnpm lint && pnpm typecheck && pnpm build` 全通过；CI 顺序与本地一致 | T16 | Codex | ✅ DONE |
| T22 | P1 | 补全“新部署证据链”并归档（run-latest、交易哈希、部署参数、时间） | `docs/deployment-artifacts/*`，`README.md`，`docs/DEPLOYMENT.md` | 文档中的部署地址、交易哈希、脚本产物三者一致；可被第三方独立复核 | T17 | Codex | ✅ DONE |
| T23 | P1 | 建立部署后链上验收脚本（post-deploy sanity） | 新增 `script/PostDeployCheck.s.sol` 或 `script/post_deploy_check.sh` | 一条命令验证 `strictXcm/notifier/isNotifierHealthy/max params/allowlist`；失败即非 0 退出码 | T22 | Codex | ✅ DONE |
| T24 | P1 | 生产化通知补偿：批量扫描 `FAILED` 并自动重试（可限速） | 新增 `script/RetryFailedNotify.s.sol` 或运维脚本目录 | 可按区块范围/streamId 扫描失败记录并执行重试；输出成功率与失败明细 | T19 | Codex | ✅ DONE |
| T25 | P2 | 指标落地：从文档指标升级到可执行采集与周报导出 | `docs/METRICS.md`，新增 `ops/metrics/*` | 自动生成周报 CSV/Markdown，包含创建数、提款成功率、通知失败率、重试成功率 | T24 | Codex | ✅ DONE |
| T26 | P2 | 安全加固：静态分析 + 高风险路径专项复核 | 新增 `SECURITY_REVIEW.md`（或 `docs/SECURITY_REVIEW.md`） | 产出审计清单（发现/级别/修复状态）；关键问题闭环后再标记 DONE | T20 | Codex | ✅ DONE |
| T27 | P2 | 发布就绪包（Release Gate v2） | `TASKS.md`，`README.md`，`docs/*`，`.github/workflows/*` | T21~T26 全部关闭；给出版本号、变更日志、回滚方案、责任人 | T21,T22,T23,T24,T25,T26 | Codex | ✅ DONE |
| T28 | P0 | AI 请求级结算适配最小闭环：新增 OpenClaw Adapter（链下 usage 记账）+ Settlement Daemon（30s 窗口聚合）+ 链上批结算入口（sidecar） | 新增 `services/adapter/*`，新增 `services/settlement-daemon/*`，新增 `contracts/UsageSettlementHub.sol`，`test/*`，`docs/ARCH_AI_SETTLEMENT.md` | 在测试环境完成“请求 -> usage_event -> 30s 聚合 -> 单笔批结算上链 -> provider 可领取”全链路；单请求不上链；失败可重试；输出吞吐/延迟/费用对比 | T27 | Codex | ✅ DONE |
| T29 | P0 | 前端模板替换并完成链上功能集成（Dashboard/Streams/Create/Settlements/Ops/Settings） | `frontend/src/*`，`frontend/package.json` | 钱包连接、create/withdraw/pause/resume/cancel/retryNotify 全流程可用；`pnpm -C frontend ci-check` 通过 | T19,T28 | Codex | ✅ DONE |
| T30 | P0 | Vercel 正式环境发布与域名可访问验收 | `frontend/vercel.json`，`script/deploy_frontend_vercel.sh` | 产出 production URL，可访问并可连接钱包；Vercel 构建日志归档 | T29 | Codex | ✅ DONE |
| T31 | P1 | 前端构建分包与 Ops 管理员白名单可配置化 | `frontend/vite.config.ts`，`frontend/src/App.tsx`，`frontend/.env.example` | 主包不再单 chunk 超 500KB；`NEXT_PUBLIC_ADMIN_ALLOWLIST` 生效 | T29 | Codex | ✅ DONE |
| T32 | P1 | 新增 BFF/HTTP API 层（对齐 PRD `/v1/*`） | 新增 `services/api/*` | 实现 `health/config/usage-events/settlement/*` 最小集并提供 OpenAPI 文档 | T28,T30 | Codex | ✅ DONE |
| T33 | P0 | 上线冻结基线：合约地址、前端/BFF 环境变量、发布 Commit 与配置校验和固化 | `docs/DEPLOYMENT.md`，`docs/deployment-artifacts/*`，`docs/RELEASE_GATE_V2.md` | 产出 freeze 清单（含 checksum 与时间戳）；冻结后变更必须有审批记录；可一键复核当前线上配置 | T32 | - | TODO |
| T34 | P0 | 编制“正式上线前最终演练”Runbook（从入口到链上结算到告警恢复） | 新增 `docs/REHEARSAL_RUNBOOK.md`，`script/post_deploy_check.sh`，`script/retry_failed_notify.sh` | Runbook 覆盖 pre-check/deploy/smoke/rollback；值班同学可按文档独立完成一次演练 | T33 | - | TODO |
| T35 | P0 | 预发全链路彩排（含线上小额冒烟交易复验）并归档证据 | 新增 `docs/rehearsal-artifacts/*`，`docs/MORNING_REPORT_*.md` | 完成 create->withdraw->通知失败->retry->claim 全流程；归档 tx hash、日志、截图、耗时与异常处理记录 | T34 | - | TODO |
| T36 | P0 | 故障注入演练：RPC 降级、notifier 异常、BFF 重启与恢复 | `services/api/*`，`services/settlement-daemon/*`，新增 `docs/INCIDENT_PLAYBOOK.md` | 至少 3 类故障均完成“发现-处置-恢复”闭环；无资金损失；关键队列不积压；形成复盘项 | T35 | - | TODO |
| T37 | P0 | 回滚与应急权限演练：`strictXcm/notifier` 切换、前端回滚、治理权限确认 | `docs/SECURITY.md`，`docs/RELEASE_GATE_V2.md`，新增 `docs/ROLLBACK_DRILL.md` | 回滚路径实操可用；治理权限链路可验证；定义 RTO/RPO 并满足目标阈值 | T36 | - | TODO |
| T38 | P0 | Go/No-Go 发布门禁签署（产品/技术/安全/运维） | 新增 `docs/GO_NO_GO_CHECKLIST.md`，`TASKS.md` | 无未接受的 P0/P1 风险；四方签署完成；发布窗口与回滚窗口明确 | T37 | - | TODO |
| T39 | P1 | 上线首周值班与告警演练（7x24 响应机制） | `docs/METRICS.md`，新增 `ops/oncall/*` | 值班表、升级路径、告警阈值与抑制规则齐备；完成一次告警 drill；责任人明确 | T38 | - | TODO |
| T40 | P0 | 上线日 D-Day 任务单（分钟级执行与验收打点） | 新增 `docs/LAUNCH_DAY_RUNBOOK.md`，`docs/MORNING_REPORT_*.md` | 形成按时间轴的执行清单（owner/动作/验收/回滚点）；至少完成 1 次桌面推演 | T38,T39 | - | TODO |
| T41 | P0 | 审计与尽调范围冻结：资产、信任边界、威胁面、排除项 | `docs/SECURITY_REVIEW.md`，新增 `docs/AUDIT_SCOPE.md` | 明确 in-scope（合约/BFF/daemon/前端关键路径）；边界与假设可被第三方复核 | T33 | - | TODO |
| T42 | P0 | 建立安全检测流水线：静态分析 + 依赖漏洞扫描 + 周期报告 | `.github/workflows/*.yml`，`docs/SECURITY_REVIEW.md` | 每周自动产出扫描结果；High/Critical 默认阻断发布；留存报告与修复证据 | T41 | - | TODO |
| T43 | P1 | 外部审计问题台账与修复 SLA 机制 | 新增 `docs/AUDIT_TRACKER.md`，`docs/SECURITY_REVIEW.md` | 每条问题具备等级/owner/ETA/状态/证据链接；逾期自动进入风险清单 | T41 | - | TODO |
| T44 | P1 | 尽调证据包维护：架构、部署、权限、监控、应急、变更记录 | 新增 `docs/DD_PACKAGE.md`，`docs/DEPLOYMENT.md`，`docs/ARCH_AI_SETTLEMENT.md` | 形成对外可交付目录索引；每项材料有来源链接与最后更新时间 | T41,T22 | - | TODO |
| T45 | P1 | 依赖与许可证合规维护（SBOM + 三方组件风险） | 新增 `docs/SBOM.md`，`frontend/package.json`，`services/*/package.json` | 输出 SBOM 与许可证清单；识别不兼容许可证并给出替换/隔离方案 | T42 | - | TODO |
| T46 | P1 | 密钥与访问控制周期复核（链上权限、RPC、Vercel、CI） | 新增 `docs/ACCESS_REVIEW.md`，`docs/SECURITY.md` | 完成季度复核模板；移除冗余权限；关键凭据轮换流程可执行并留痕 | T41 | - | TODO |
| T47 | P1 | 审计修复回归包：关键漏洞回归测试与攻击路径防回归 | `test/*`，`services/api/*`，`docs/SECURITY_REVIEW.md` | 每个已关闭审计问题至少绑定 1 个回归用例或脚本；CI 持续通过 | T42,T43 | - | TODO |
| T48 | P0 | 审计与尽调月度维护节奏固化（巡检、复盘、风险后果跟踪） | `TASKS.md`，`docs/MORNING_REPORT_*.md`，`docs/SECURITY_REVIEW.md` | 连续执行 >=1 个完整月度周期；形成“风险-后果-缓解-负责人-截止时间”闭环清单 | T44,T45,T46,T47 | - | TODO |
| T49 | P0 | 商业化支付语义设计冻结：从“即时流”升级为“待激活流”模型 | 新增 `docs/ARCH_COMMERCIAL_TRIGGERED_STREAMS.md`，`README.md`，`TASKS.md` | 明确 `PENDING -> ACTIVE` 状态机、trigger policy、activation deadline、provider-set plan 边界；形成对内一致语义 | T48 | Codex | ✅ DONE |
| T50 | P0 | 核心合约 Phase 1：引入 `Pending Stream` / `activateStream` / `cancelBeforeActivation` / `expirePendingStream` | `contracts/PolkaStream.sol`，`test/*` | 创建流只锁资不计费；仅激活后开始累计 owed；未激活可取消或过期退款；兼容 pause/resume/cancel | T49 | Codex | ✅ DONE |
| T51 | P0 | Trigger policy 实现：`SENDER_ONLY / RECEIVER_ONLY / EITHER_PARTY / BOTH_PARTIES / AUTHORIZED_OPERATOR` | `contracts/PolkaStream.sol`，`test/*`，新增 `docs/API_GOVERNANCE.md` 或相关文档 | 不同触发策略权限正确；双边确认路径可审计；operator 触发边界明确 | T50 | Codex | ✅ DONE |
| T52 | P1 | Phase 1 前端改造：把“创建流”改为“锁定预算”，新增 Pending/Activate/Expire 视图与操作 | `frontend/src/*`，`docs/FRONTEND_PRD_V1.md` | 前端能清晰区分 `Pending` 与 `Active`；创建后不再误导为“立即计费”；激活与退款路径可演示 | T50,T51 | Codex | DOING |
| T53 | P1 | BFF / API 配套：暴露 Pending Stream、activation、confirmation、deadline 查询接口 | `services/api/*`，`docs/API_GOVERNANCE.md` | API 层支持 pending/active 生命周期读取与触发；OpenAPI 或 README 文档同步 | T50,T51 | Codex | ✅ DONE |
| T54 | P1 | Core contract Phase 2：增加 `ServicePlan` / provider-set flow 能力 | `contracts/PolkaStream.sol`，`contracts/PolkaStreamServicePlanRegistry.sol`，`test/*`，新文档 | provider 可发布/更新/停用服务计划；payer 可基于 plan 创建 pending stream；plan 约束生效 | T52,T53 | Codex | ✅ DONE |
| T55 | P1 | 商业化风控闭环：`termsHash` / `serviceRef` / activation deadline / 双边确认争议路径 | `contracts/*`，`docs/SECURITY.md`，`docs/ARCH_COMMERCIAL_TRIGGERED_STREAMS.md` | 付款开始时点、服务引用、取消和过期退款规则都可追溯；关键争议路径有文档和测试 | T54 | Codex | ✅ DONE |
| T56 | P1 | 商业化 Demo 与对外叙事升级：从“create stream”演示为“plan -> fund -> activate -> withdraw” | `docs/SUBMISSION_COPY.md`，`docs/DEMO_VIDEO_SCRIPT.md`，`docs/PITCH_DECK_FULL.md`，`frontend/src/*` | Demo Day 和对外商业资料能准确反映新生命周期；主轴仍保持 streaming payments | T54,T55 | - | TODO |
| T57 | P0 | Agent Integration Spec：明确 agent 角色、接入路径、接口边界与风控约束 | `docs/AGENT_INTEGRATION_SPEC.md`，`docs/AGENT_MCP_SKILL_ADAPTER.md` | buyer/provider/operator 三类 agent 的路径、接口、鉴权和边界可被第三方直接复核 | T54,T55 | Codex | ✅ DONE |
| T58 | P0 | MCP / Skill Adapter：提供可调用的 agent tool surface，而不是只停留在口头支持 | `services/agent-mcp/*`，`README.md`，`.env.example` | 官方 MCP stdio server 可运行；至少可 `tools/list` + `tools/call`；覆盖直接链上商业流与 API 触发/结算动作 | T57 | Codex | ✅ DONE |

## 执行规范（建议）
- 每个任务单独分支：`codex/<task-id>-<short-name>`
- 每个任务最小提交要求：代码 + 测试 + 文档更新
- 每个任务合并前必须附带：
  - `forge test` 结果
  - 相关覆盖率截图或摘要
  - 前端改动的构建结果（如涉及）

## 当前阻断点（请先处理）
- 无（前端已完成生产发布）。

## 下一阶段阻断点（新增）
- T33~T40 未完成前，不进入“正式运营”。
- T41~T48 未落地前，对外审计/尽调材料存在断层风险，可能影响合作与上线节奏。
- Hackathon 提交视频母版已生成，但 DoraHacks 最终公开视频链接仍需手动上传回填。

## 本次修复简述
- [x] T01：`withdraw` 默认改为“先提款后通知”，通知失败仅记状态；`strictXcm=true` 时保留强一致回滚。
- [x] T02：新增 `IXcmNotifier` 与 `XcmPrecompileNotifier`，移除主合约硬编码 precompile 调用。
- [x] T03：新增 `NotifyStatus`、`notifyRecords`、`retryNotify(streamId, withdrawId)` 与状态事件。
- [x] T04：引入 `Ownable2Step`，治理控制 `notifier/strictXcm/allowlist/max params`。
- [x] T05：新增 `tokenAllowlist`、`maxDuration`、`maxDepositPerStream` 校验边界。
- [x] T06：新增 `script/HealthCheck.s.sol`，并在 `script/Deploy.s.sol` 中强制部署前健康检查。
- [x] T07：补齐异常路径测试，`forge test` 通过，`contracts/PolkaStream.sol` 分支覆盖率 `92.77%`。
- [x] T08：新增 invariant 测试，验证 `withdrawn + refunded + contractBalance == deposit`。
- [x] T09：前端增加链/合约/notifier/token 白名单前置检查，未通过时按钮禁用并提示。
- [x] T10：UI 仅显示可执行错误提示，详细异常仅输出控制台。
- [x] T11：数据读取改为事件增量同步 + 分页加载，减少高频全量轮询。
- [x] T12：新增 CI 工作流，门禁包含 forge test/coverage 与 frontend lint/typecheck/build。
- [x] T13：统一包管理器为 pnpm，删除 `frontend/package-lock.json`，补充构建产物忽略规则。
- [x] T14：重写 README，并新增 `docs/SECURITY.md` 覆盖威胁模型/恢复流程/治理流程。
- [x] T15：新增 `docs/METRICS.md`，定义创建数/提款成功率/通知失败率/重试成功率指标。
- [x] T16：验证干净 checkout（无 `.next/types` 预生成）下 `pnpm lint && pnpm typecheck && pnpm build` 稳定通过。
- [x] T17：已完成链上部署与切换：`XcmPrecompileNotifier=0xb74411FcD5DB3B3e40f4a3FeE2144eA01E4Dd00e`，`PolkaStream=0x0Ae8b341F31194DD34f11E075E34e3C266EF4d8D`，并更新前端地址。
- [x] T18：健康检查改为“拒绝成功空返回（EOA 假健康）+ 接受可达 precompile 的 revert 语义”，避免误判。
- [x] T19：前端支持显示 `FAILED` 通知记录，并提供 `Retry Notify` 一键重试与结果回显。
- [x] T20：新增 `XcmNotifierAndHealthCheck` 测试套件，覆盖 notifier 适配器与 healthcheck 关键分支。
- [x] T21：新增 `frontend/tsconfig.typecheck.json`，CI 前端门禁改为 `pnpm ci-check`，并完成连续三次稳定构建验证。
- [x] T22：补全部署证据链：归档 `docs/deployment-artifacts/*`，修正 `release-gate` 交易哈希与时间并新增 `docs/DEPLOYMENT.md`。
- [x] T23：新增 `script/post_deploy_check.sh`，一条命令校验 `strictXcm/notifier/isNotifierHealthy/max params/allowlist`，失败非 0 退出。
- [x] T24：新增 `script/retry_failed_notify.sh`，支持按区块范围/streamId 扫描 `FAILED` 并批量重试，含限速、dry-run 与汇总输出。
- [x] T25：新增 `ops/metrics/export_weekly_metrics.sh`，自动导出周报 CSV/Markdown；`docs/METRICS.md` 升级为可执行采集流程。
- [x] T26：新增 `docs/SECURITY_REVIEW.md`，输出高风险路径复核清单（发现/级别/修复状态）并确认阻断项清零。
- [x] T27：新增 `docs/RELEASE_GATE_V2.md`，补齐版本号、变更日志、回滚方案、责任人，并更新 README 发布入口。
- [x] T28：新增 `UsageSettlementHub` sidecar 合约、`OpenClaw Adapter` 与 `Settlement Daemon`（30s 聚合+retry queue），并在测试环境打通“请求->usage_event->批结算->provider claim”闭环，产出吞吐/延迟/费用对比报告（`docs/ARCH_AI_SETTLEMENT.md`）。
- [x] T29：已用 `polkastream-ops` 模板替换前端并完成链上功能集成（钱包连接、create/withdraw/pause/resume/cancel/retryNotify、失败通知展示）。
- [x] T30：已完成 Vercel 生产发布，部署状态 `Ready`，生产地址 `https://frontend-dxgqfor1f-ddbbs-projects-9779c35f.vercel.app`，别名 `https://frontend-mauve-beta-68.vercel.app`。
- [x] T31：前端构建分包已完成（`index/charts/viem/icons` 拆分）；Ops 管理入口改为 `NEXT_PUBLIC_ADMIN_ALLOWLIST` 可配置。

## 复审新增说明
- 本文档已从“第一阶段改造”切换到“第二阶段收口”。
- T01~T20 已完成并通过本地验收。
- `release-gate`（T16/T17/T18）已闭环。

## 下一阶段目标（本次新增）
- 第三阶段目标一：完成上线前最终演练任务单（T33~T40），把“可用”提升为“可正式运营”。
- 第三阶段目标二：完成审计与尽调维护任务单（T41~T48），建立持续可复核的安全与尽调体系。
- 第四阶段目标一：完成商业化支付语义升级（T49~T53），把“流支付原型”升级为“待激活、可触发、可确认的服务支付协议”。
- 第四阶段目标二：完成 provider-set flow 与商业化 demo 升级（T54~T56），把“单纯建流”升级为“服务计划 -> 锁资 -> 激活 -> 结算”闭环。
- 第五阶段目标：完成 agent 接入落地（T57~T58），把“支持 Agent”从叙事变成真实可调用的集成面。
