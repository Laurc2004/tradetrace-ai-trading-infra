# TradeTrace 飞行记录器 — 产品需求文档（PRD）

> ⚠️ **实现状态更新（2026-06-20 重设计）**：本文档成文较早，其中所有 **GetAgent / Playbook 回测**
> 的描述已被替换为**本地确定性回测引擎**（[agent/tools/local-backtest.ts](agent/tools/local-backtest.ts)），
> 数据来自 **Bitget 公共 K线端点**（`spot_get_candles` / `futures_get_candles`），**无需任何 Bitget key**。
> 原因：Playbook 控制面连不通。新建运行只需 `QWEN_API_KEY`。Web UI 为英文单语言扁平路由（i18n 已移除）。
> 其余设计（飞行记录器、风险账本、审批、回放、报告）保持不变。以 [README.md](README.md) 为准。

> 项目：TradeTrace AI 交易基础设施
> 起点：受 [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) Track 2
> （Infra）启发，目标是一个赛后仍会持续生长的项目。
> 英文版：[PRD.en.md](PRD.en.md)

## 1. 背景

Bitget AI Hackathon Track 2 关注的是交易基础设施：用于提升智能体效率、
交易者效率、安全性、评估、监控、可复现性的工具。评审偏好也很明确——
有深度、有完成度、有新意、有可验证使用记录的工作系统，比纯概念 Demo
更受欢迎。

TradeTrace 飞行记录器瞄准的是 AI 交易智能体缺失的那层基础设施：
**可观测性、可审计性、审批、回放、运行后分析**。

我们不打算再造一个交易聊天机器人或策略生成器，而是把一次交易智能体
运行的完整生命周期都记录下来，让它可以被回放。

## 2. 产品定义

**名字：** TradeTrace 飞行记录器

**一句话：** AI 交易智能体的飞行记录器——记录智能体"为什么这么做"、
回测策略、量化风险、在执行前把关，并把整次运行完整地、可回放地保留
下来。

**主界面：** Web UI

**次界面：** Telegram bot

**核心技术栈：**
- Eve（agent workflow、tools、channels、审批、状态、可观测性）。
- Qwen（策略解析 + 运行后报告生成）。
- GetAgent（策略回测与指标）。
- 可选的 Bitget Agent Hub / 交易 API：留给未来的模拟盘与执行适配器。

**为什么是 Eve（而不是自研编排）：** 见 [README.md](README.md)。Eve 的
`tools/`、`skills/`、`subagents/`、`channels/`、`schedules/` 与本项目
的模块一一对应；它的可观测性正好是"飞行记录器"需要的；它的多渠道抽象
是 Web 和 Telegram 共享同一份 Run / Event 存储的天然落脚点。

## 3. 问题

AI 交易智能体能力很强，但黑盒状态是危险的。

现实痛点：

- 用户无法看清智能体**为什么**做出某个决策。
- 工具调用、回测输出、风险检查、审批、执行事件散落在各种日志、面板、
  聊天记录里。
- 没有一个标准的、**以一次"运行"为单位**的审计轨迹。
- 风险闸门经常是隐式的，甚至根本没有。
- 失败或危险的运行没法清晰地回放，做不了复盘。
- 评审很难快速判断一个交易智能体项目是否真的"工作过"。

## 4. 目标

TradeTrace 要做到：

- 为每一次交易智能体的工作流创建结构化的运行记录。
- 捕获 Qwen 解析、GetAgent 回测、风险评分、审批、执行/回放、报告事件。
- 让每一次运行都可以通过可视化时间线来回放。
- 提供确定性的、规则可解释的风险评分。
- 在执行前支持人工审批。
- 基于运行证据生成运行后报告。
- 提供公开的 sample 运行，方便评审和复现。

## 5. 非目标

TradeTrace **不会**做：

- 在 MVP 阶段执行真实资金的交易。
- 承诺任何交易回报。
- 搭一个完整的交易终端。
- 从零搭一个完整的量化回测引擎。
- 支持每一种策略类型、每一家交易所。
- 做付费、订阅、多租户后台。

## 6. 用户

### AI 交易智能体开发者
需要调试和治理智能体行为。

要做的事：
- 理解一次运行成功或失败的原因。
- 看到工具调用和风险检查。
- 导出可复现的运行证据。

### 谨慎的交易者 / 研究者
想要 AI 帮忙，但不信任黑盒系统。

要做的事：
- 检查策略逻辑。
- 复核回测证据。
- 审批或拒绝高风险运行。

### 评审
需要判断这个项目是不是"真的基础设施"。

要做的事：
- 跑或回放一个完整示例。
- 验证基于真实 API 的证据。
- 理解为什么这不是又一个聊天机器人。

## 7. 最终产品形态

TradeTrace 以 **Web UI + Telegram bot** 双形态交付。

### Web UI
Web UI 是主 Demo 和评审界面。

包含：
- 新建运行页面。
- 飞行记录器运行详情页。
- 风险账本面板。
- 审批闸门面板。
- 回放模式。
- 运行后报告页。
- 轻量仪表盘。

### Telegram Bot
Telegram bot 是次要渠道。

支持：
- 从聊天里提交一条策略。
- 收到解析/回测/风险状态更新。
- 审批或拒绝 pending 的运行。
- 收到带 Web UI 链接的最终报告摘要。

### 渠道约束
两个渠道共用同一份 `Run` 对象和事件存储。在 Telegram 里发起的运行必须在
Web UI 里能看到；在 Web UI 里发起的运行可以把审批/报告通知发到 Telegram。

## 8. 核心用户旅程

### 旅程 A：Web UI 正常路径
1. 用户打开"新建运行"。
2. 用户输入自然语言策略。
3. Qwen 把它解析成 `StrategySpec`。
4. GetAgent 跑回测。
5. 风险引擎返回 `Go` 或 `Review`。
6. 必要时用户审批。
7. 进入回放 / 模拟执行。
8. 用户查看时间线和报告。

### 旅程 B：Telegram 审批路径
1. 用户在 Telegram 发送 `/run <strategy>`。
2. Bot 回复解析出的摘要。
3. Bot 推送回测和风险结果。
4. 如果需要审批，bot 给出 Approve / Reject 按钮。
5. 用户审批。
6. Bot 推送最终报告摘要和 Web UI 链接。

### 旅程 C：高风险被拦截路径
1. 用户输入危险策略，例如类 martingale / 高杠杆 / 无限制加仓。
2. Qwen 解析器抽取出与风险相关的意图。
3. 风险引擎标记为 High。
4. 审批闸门拦截这次运行。
5. 事件报告解释为什么被拦。
6. 时间线可以回放完整的拦截路径。

## 9. 功能需求

### F1. 运行创建
- 生成唯一 `run_id`。
- 持久化初始输入和来源渠道。
- 跟踪状态转移。

状态：
- `created`
- `parsing`
- `backtesting`
- `risk_review`
- `awaiting_approval`
- `executing`
- `completed`
- `blocked`
- `failed`

### F2. 策略解析
- 输入：自然语言策略。
- 输出：结构化 `StrategySpec`。
- 必填字段：
  - `symbol`
  - `timeframe`
  - `direction`
  - `entry_conditions`
  - `exit_conditions`
  - `stop_loss`
  - `take_profit`
  - `position_limit`
  - `risk_constraints`
  - `unknowns`
- 失败模式：返回缺失字段和建议的澄清问题。

### F3. GetAgent 回测适配
- 把 `StrategySpec` 转成 GetAgent 请求格式。
- 跑回测或取回测结果。
- 提取：
  - `pnl`
  - `sharpe`
  - `max_drawdown`
  - `win_rate`
  - `trade_count`
  - `backtest_period`
- 存储原始结果引用，但不暴露密钥。

### F4. 风险账本
- 优先用确定性、基于规则的评分。
- LLM 仅用于"解释性摘要"。
- 输出：
  - `score`
  - `level`：Low / Medium / High
  - `recommendation`：Go / Review / Block
  - `triggered_rules`
  - `reasons`

示例风险规则：
- 高杠杆或无限制加仓 → High / Block。
- 缺少止损 → Medium 或 High（视策略而定）。
- 最大回撤超过阈值 → Review 或 Block。
- 交易次数极少 → Review。
- 入场 / 出场条件模糊 → Review。

### F5. 审批闸门
- 低风险：可自动继续。
- 中风险：必须审批。
- 高风险：默认拦截。
- 审批记录必须包含：决策、原因、时间戳、渠道。

### F6. 飞行时间线
- 所有主要工作流步骤都发出事件。
- 事件展示 actor、状态、时间戳、耗时、输入摘要、输出摘要。
- UI 支持展开事件。

必含事件类型：
- `strategy.input.received`
- `strategy.parsed`
- `getagent.backtest.started`
- `getagent.backtest.completed`
- `risk.scored`
- `approval.requested`
- `approval.accepted`
- `approval.rejected`
- `execution.replay.started`
- `execution.paper.started`
- `execution.updated`
- `run.blocked`
- `run.report.generated`
- `run.failed`

### F7. 回放模式
- 回放保存下来的历史事件。
- 用真实跑过的运行记录。
- 让 Demo 在不依赖 live API 的情况下稳定可演示。
- 明确把回放数据标注为"历史运行数据"。

### F8. 运行后报告
- 用运行证据生成一份人话报告。
- 包含：
  - 执行摘要。
  - 策略意图。
  - 回测证据。
  - 风险发现。
  - 审批决策。
  - 执行/回放结果。
  - 建议的下一步。

### F9. Telegram Bot
- 命令：
  - `/start`
  - `/run <strategy>`
  - `/status <run_id>`
  - `/approve <run_id>`
  - `/reject <run_id> <reason>`
  - `/report <run_id>`
- Bot 消息必须带 Web UI 运行详情页链接。
- 审批动作必须记录到和 Web 审批同一份 `ApprovalRecord` 对象里。

### F10. 仪表盘
- 展示近期运行。
- 展示风险分布。
- 展示 Block / Review / Go 计数。
- 展示平均运行耗时。
- 展示失败运行。

## 10. 数据对象

### Run
```json
{
  "run_id": "run_001",
  "source_channel": "web|telegram",
  "status": "created|parsing|backtesting|risk_review|awaiting_approval|executing|completed|blocked|failed",
  "user_input": "...",
  "market": "BTCUSDT",
  "started_at": "...",
  "ended_at": "...",
  "final_decision": "go|review|block|failed",
  "report_id": "report_001"
}
```

### StrategySpec
```json
{
  "strategy_id": "strategy_001",
  "run_id": "run_001",
  "raw_prompt": "...",
  "structured_strategy": {},
  "unknowns": [],
  "confidence_notes": []
}
```

### BacktestResult
```json
{
  "backtest_id": "bt_001",
  "run_id": "run_001",
  "provider": "bitget_getagent",
  "period": "...",
  "pnl": 0,
  "sharpe": 0,
  "win_rate": 0,
  "max_drawdown": 0,
  "trade_count": 0,
  "raw_summary_ref": "..."
}
```

### RiskAssessment
```json
{
  "risk_id": "risk_001",
  "run_id": "run_001",
  "score": 72,
  "level": "Medium",
  "recommendation": "Review",
  "triggered_rules": [],
  "reasons": []
}
```

### ApprovalRecord
```json
{
  "approval_id": "approval_001",
  "run_id": "run_001",
  "required": true,
  "decision": "approved|rejected|blocked|not_required",
  "reviewer": "web-user|telegram-user",
  "reason": "...",
  "channel": "web|telegram",
  "timestamp": "..."
}
```

### Event
```json
{
  "event_id": "evt_001",
  "run_id": "run_001",
  "timestamp": "...",
  "type": "risk.scored",
  "actor": "user|agent|qwen|getagent|risk_engine|approval|execution",
  "status": "started|completed|failed",
  "input_summary": "...",
  "output_summary": "...",
  "duration_ms": 1200,
  "raw_ref": "...",
  "trace_parent": "evt_000"
}
```

### Report
```json
{
  "report_id": "report_001",
  "run_id": "run_001",
  "executive_summary": "...",
  "key_findings": [],
  "risk_notes": [],
  "audit_trail": [],
  "next_actions": []
}
```

## 11. 成功指标

产品成功：
- 完整运行完成率。
- 事件完整率。
- 风险有解释的运行占比。
- 可回放时间线的运行占比。
- 拦截到的高风险 Demo 案例数。

黑客松 / 交付成功：
- 至少 2 条可回放的 sample 运行。
- 至少 1 条真实 GetAgent-backed 的回测记录。
- 至少 1 条被拦截的高风险策略。
- README 能让另一个开发者/评审直接跑或回放。
- 3 分钟视频完整呈现一次循环。

## 12. 验收标准

MVP 通过条件：

- 用户能在 Web UI 发起一次运行。
- 用户能在 Telegram 发起或审批一次运行。
- 一次运行记录了：解析、回测、风险、审批、回放/执行、报告事件。
- 健康策略走到 Go / Review。
- 危险策略走到 Block。
- GetAgent 结果被存储和展示。
- 风险账本解释了触发的规则。
- 回放模式不需要 live API 也能跑。
- 运行后报告引用的是真实的运行证据。
- 日志、UI、报告、sample 数据里没有任何 API key 或密钥。
