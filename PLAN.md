# TradeTrace 实施计划

> ⚠️ **实现状态更新（2026-06-20 重设计）**：Playbook 控制面连不通，回测已改为**本地确定性引擎**
> （[agent/tools/local-backtest.ts](agent/tools/local-backtest.ts)，Bitget 公共 K线，无需 key）。
> 本文 `GetAgent / Playbook` 字样为历史规划，实际实现见 [README.md](README.md)。
> Web UI 为英文单语言扁平路由（i18n 已移除）。

> 范围：TradeTrace AI 交易基础设施的实施方案。
> 起点：受 [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) Track 2
> （Infra）启发，目标是一个赛后仍会持续生长的项目。
> 英文版：[PLAN.en.md](PLAN.en.md)

## 1. 最终形态决策

TradeTrace 以 **Web UI + Telegram bot** 双形态交付。

### 主形态：Web UI
Web UI 是主要的演示和评审界面。

要让人一眼看懂这个想法：

- 一条长得像飞行记录器的时间线。
- 一个"风险账本"，讲清楚这次运行为什么被放行、被复审或被拦截。
- 一份"运行后报告"，把原始事件变成可审计的叙事。
- 一个"回放模式"，即便外部 API 不稳也能演示。

### 次形态：Telegram bot
Telegram bot 是真实使用场景的渠道：

- 从聊天里发起一次运行。
- 收到状态更新。
- 审批或拒绝运行。
- 收到最终报告摘要。

Telegram 不会替代 Web UI。它只是用来证明"多渠道、人在回路"的治理能力
——这正好用上 Eve 的 channel 模型。

## 2. 架构

```text
                         +-------------------------+
                         |        Web UI           |
                         | 新建运行 / 时间线 /     |
                         | 风险账本 / 报告         |
                         +-----------+-------------+
                                     |
+--------------------+               |               +--------------------+
|    Telegram Bot    |---------------+--------------▶|   Eve Agent Runtime |
| /run /approve      |               |               | workflow + tools    |
+--------------------+               |               +---------+----------+
                                     |                         |
                                     v                         v
                         +-------------------------+   +--------------------+
                         | Run/Event 存储          |   | 外部适配器         |
                         | runs, events, risk,     |   | Qwen + GetAgent    |
                         | approvals, reports      |   | Bitget 可选        |
                         +-------------------------+   +--------------------+
```

## 3. Eve 映射

我们把 Eve 当成 agent 编排层来用，不只是套个壳子。

各模块对应关系：

| Eve 区域 | TradeTrace 用途 |
|---|---|
| `instructions.md` | 智能体身份、安全边界、报告风格 |
| `agent.ts` | 主运行生命周期编排 |
| `tools/` | Qwen 解析、GetAgent 适配、风险引擎、Trace 存储、回放 |
| `skills/` | 风险账本规则、运行摘要 / 报告格式 |
| `subagents/` | Trace 分析师、风险官、事件报告员 |
| `channels/` | Web/API 入口 + Telegram bot 渠道 |
| `schedules/` | P1 模拟盘监控器 / 周期性的运行状态更新 |
| Eve 可观测性 | 工具调用和工作流 turn 的调试与评审证据 |

如果 Eve beta 模板的文件布局略有差异，保持上面这些模块的职责不变。

### 为什么选 Eve 而不自己写

- **Eve 的原语和我们的产品模型 1:1 对应**——见 README。
- **自带可观测性**——这正是飞行记录器需要的。
- **多渠道是头等公民**——`channels/` 抽象让 Web 和 Telegram 共享同一份
  `Run` / `Event` 存储成为天然实现。
- **Schedules 干净地容纳未来的模拟盘监控**。
- **Eve 用来做稳定的部分（tools、workflow、channels、可观测性）**——
  特性不稳定时，把对应职责放到普通 TypeScript 模块里，保证产品照样跑。

## 4. 项目结构

```text
.
+-- README.md / README.en.md
+-- PRD.md    / PRD.en.md
+-- PLAN.md   / PLAN.en.md
+-- LICENSE
+-- agent/
|   +-- instructions.md
|   +-- agent.ts
|   +-- tools/
|   |   +-- qwen-strategy-parser.ts
|   |   +-- getagent-backtest.ts
|   |   +-- bitget-skill-evidence.ts
|   |   +-- risk-engine.ts
|   |   +-- trace-event.ts
|   |   +-- approval-gate.ts
|   |   +-- report-generator.ts
|   +-- skills/
|   |   +-- risk-ledger.md
|   |   +-- run-summary.md
|   +-- channels/
|   |   +-- web.md
|   |   +-- telegram.md
|   +-- subagents/
|   |   +-- trace-analyst.md
|   |   +-- risk-officer.md
|   |   +-- incident-writer.md
|   +-- schedules/
|       +-- monitor-paper-trading.md
+-- app/
|   +-- page.tsx
|   +-- runs/
|   |   +-- new/page.tsx
|   |   +-- [runId]/page.tsx
|   +-- dashboard/page.tsx
+-- components/
+-- lib/
|   +-- types.ts
|   +-- risk-rules.ts
|   +-- sample-runs.ts
|   +-- redaction.ts
+-- samples/
    +-- run-success.json
    +-- run-blocked.json
```

具体布局可以适配 Eve / Next.js 的初始化，但根目录文档和 `samples/` 应当
保持方便评审直接查看。

## 5. MVP 范围

### 必须有

- Web UI 新建运行页面。
- Web UI 运行详情页（含时间线）。
- Qwen 策略解析。
- GetAgent 回测适配。
- 风险引擎。
- 审批闸门。
- 回放模式。
- 运行后报告。
- Telegram `/run`、`/status`、`/approve`、`/reject`、`/report` 基础命令。
- 2-3 个 sample 运行 JSON。

### 锦上添花

- 仪表盘统计。
- 模拟盘 live 状态适配。
- 决策图可视化。
- OpenTelemetry 风格的 trace / span ID。
- Webhook 告警。

## 6. 实施顺序

### Phase 1：数据与运行生命周期
先把骨架立起来。

任务：
- 定义 Run、Event、StrategySpec、BacktestResult、RiskAssessment、
  ApprovalRecord、Report 的 TypeScript 类型。
- 实现 Trace Store 抽象。
- 实现 run 状态转移。
- 实现事件追加 / 读取 API。
- 创建 sample fixture。

成果：
- 即便没有 UI 和外部 API，run 也可以存在。
- 回放模式可以直接从存储的事件渲染。

### Phase 2：外部适配器
接进真实证据。

任务：
- 用严格的 JSON schema 实现 Qwen 解析器。
- 实现 GetAgent 回测适配。
- 对所有日志和保存的输出做敏感信息脱敏。
- 存储原始响应的引用，或保存脱敏后的摘要。

成果：
- 至少有一个真实的"解析 + 回测"结果可以存为 sample 运行。

### Phase 3：风险与审批
把它做成治理基础设施。

任务：
- 实现确定性的风险规则。
- 计算风险评分和推荐动作。
- 实现审批闸门状态转移。
- 同时支持 Web 和 Telegram 的审批记录。

成果：
- 健康策略走 Go / Review。
- 危险策略走 Block。

### Phase 4：Web UI
让 Demo 留下印象。

任务：
- 新建运行页面。
- 运行详情时间线。
- 风险账本面板。
- 审批面板。
- 报告面板。
- 时间允许再加仪表盘。

成果：
- 评审在 30 秒内就能用眼睛理解"飞行记录器"这个概念。

### Phase 5：Telegram bot
证明多渠道治理。

任务：
- `/run <strategy>` 启动一次运行。
- `/status <run_id>` 返回当前状态。
- `/approve <run_id>` 审批 pending 的运行。
- `/reject <run_id> <reason>` 拒绝 pending 的运行。
- `/report <run_id>` 返回报告摘要和 Web UI 链接。

成果：
- 在 Telegram 里能发起或审批一次运行，并在 Web UI 里查看。

### Phase 6：交付打磨
让它对评审友好。

任务：
- 保存 sample 运行 JSON。
- 加截图 / GIF。
- 录 3 分钟视频。
- 验证 README 快速开始。
- 确认仓库里没有密钥。
- 清晰地解释 live 模式 vs replay 模式。

成果：
- 公开仓库自解释、可验证。

## 7. 节奏（不绑死在 3-5 天）

最初的项目节奏受黑客松时间窗口驱动。把它当作一次冲刺，不是终态。
之后的工作按以下顺序推进：

1. 锁定骨架（schema、事件存储、fixture、UI 线框）。
2. 接 Qwen + GetAgent + 风险。
3. 搭飞行记录器 Web UI。
4. 接入 Telegram + 回放 + sample。
5. 提交材料打磨。
6. 提交之后：模拟盘 live 模式、trace/span ID、webhook 告警、多智能体 CI/CD。

## 8. Demo 脚本

### Demo 1：健康 / 复审策略

输入：

```text
当 BTC 1h 周期 EMA20 上穿 EMA50、且 RSI 由 45 上穿到 55 时做多。
止损 1.5%，止盈 4%，最大仓位 15%，连续亏损两次后暂停。
```

要展示：

- Web UI 发起运行。
- Qwen 解析出策略。
- GetAgent 回测指标。
- 风险账本推荐 Go 或 Review。
- 需要时审批。
- 出现回放 / 执行事件。
- 运行后报告总结整条决策链。

### Demo 2：危险被拦截的策略

输入：

```text
只要价格下跌就不断加仓直到反弹。用高杠杆尽快把亏损赚回来。
```

要展示：

- Qwen 识别出类 martingale 行为。
- 风险引擎标记出"无限制加仓 / 高杠杆"。
- 这次运行被拦截。
- 事件报告解释为什么。
- 回放展示完整的拦截路径。

### Demo 3：Telegram 渠道

要展示：

- 在 Telegram 里 `/run <strategy>`。
- Bot 返回 run id 和 Web UI 链接。
- Bot 在需要审批时给出选项。
- `/approve <run_id>` 同步更新同一份 Web UI 运行。

## 9. 风险规则（MVP）

从透明、确定性的规则起步。

示例评分：

| 规则 | 严重度 | 对推荐动作的影响 |
|---|---|---|
| 提到高杠杆 | High | Review / Block |
| 无限制加仓 / 类 martingale | Critical | Block |
| 缺少止损 | Medium | Review |
| 仓位上限 > 30% | Medium | Review |
| 最大回撤 > 20% | High | Review / Block |
| Sharpe < 0.5 | Medium | Review |
| 交易次数 < 10 | Low/Medium | Review 备注 |
| 入场 / 出场模糊 | Medium | Review |

风险引擎给出的理由必须让评审不用读代码就能看懂。

## 10. 安全与脱敏

任何地方都不存储或显示：

- `QWEN_API_KEY`
- `BITGET_API_KEY`
- `BITGET_SECRET_KEY`
- `BITGET_PASSPHRASE`
- `TELEGRAM_BOT_TOKEN`

所有外部原始响应在保存到 `samples/` 或展示到 UI 之前都要做脱敏。

sample 运行记录要包含足够证据供评审验证行为，但不能包含密钥或
账户身份信息。

## 11. 降级策略

### 如果 GetAgent 不稳
- 使用回放模式展示历史真实运行数据。
- 明确标注为"基于先前真实 API 输出的回放"。
- 在 `samples/` 里保留一份静态示例。

### 如果 Qwen 解析不稳
- 用严格的 JSON schema 和模板 prompt。
- 提供"示例策略"按钮。
- 回退到可编辑的结构化表单。

### 如果 Telegram 接入时间紧
- 保持 Web UI 完整。
- 只实现 `/run` 和 `/status`，把审批写成 P1 待办。

### 如果模拟盘 live 模式来不及
- 用回放执行。
- 把执行适配器接口保留下来，为未来的 live 模式做准备。

### 如果 Eve beta 拦住了某个特性
- 用普通 TypeScript 模块保住产品结构。
- Eve 用来做稳定的部分：tools、workflow、channels、可观测性。

## 12. 验收清单

- 公开 GitHub 仓库。
- README 包含快速开始。
- `PRD.md`、`PLAN.md`（中文为正本，英文见 `*.en.md`）。
- sample 运行 JSON 文件。
- 至少一条真实 GetAgent-backed 的回测记录。
- 截图：
  - 新建运行
  - 时间线
  - 风险账本
  - 审批闸门
  - 运行后报告
  - Telegram bot 消息
- 3 分钟 Demo 视频。
- 清晰的限制声明：仅 paper / replay，不执行真实资金。
- 仓库里没有任何密钥。

## 13. 一句话定位

```text
TradeTrace 是 AI 交易智能体的飞行记录器。
它把每一次策略运行都做成可回放的审计轨迹：
用户提了什么需求、模型怎么解析的、GetAgent 怎么测的、
触发了哪些风险、谁批的、之后又发生了什么。

我们不是再造一个交易聊天机器人。
我们在搭一层"自主智能体"和"交易执行"之间缺失的治理基础设施。
```
