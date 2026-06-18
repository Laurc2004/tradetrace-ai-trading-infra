# TradeTrace — AI 交易智能体的"黑匣子"

> 一个开源的 AI 交易基础设施项目：记录智能体"为什么这么做"、回测策略、量化风险、在执行前把关，并把整次运行完整地、可回放地保留下来。

TradeTrace 把每一次 AI 交易智能体的运行都变成可回放、可审计的轨迹：

```text
自然语言策略 → Qwen 解析 → Bitget Skill 证据包 → Playbook 回测
            → 风险账本 → 审批闸门 → 模拟 / 回放执行 → 运行后报告
```

这个项目本身定位为**通用的 AI 交易基础设施**，任何人都可以基于它做扩展。
[Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) 给了它最初的问题
切入点（Track 2 — Infra）和一组可以接进去的具体积木（Bitget Playbook、
Bitget Agent Hub 技能、Qwen）。Hackathon 是火花，不是目标——系统的设计是
为了在赛后继续生长。

## 为什么做这件事

AI 交易智能体能力很强，但黑盒状态是危险的。今天的现实是：

- 用户很难看清智能体**为什么**做出某个决策。
- 工具调用、回测输出、风险检查、审批、执行事件散落在各种日志、面板、聊天
  记录里。
- 没有一个标准的、**以一次"运行"为单位**的审计轨迹。
- 风险闸门经常是隐式的，甚至根本没有。
- 失败或危险的运行没法清晰地回放，做不了复盘。

TradeTrace 是补在"自主智能体"和"交易执行"之间那层治理基础设施——交易
智能体版的黑匣子 + 驾驶舱语音记录器。

## 系统能提供什么

- **Web UI**：发起运行、查看"飞行记录器"时间线、读风险账本、做审批、查看
  运行后报告。
- **Telegram Bot**：作为互补渠道——从聊天里提交策略、审批 / 拒绝运行、收到
  报告摘要。
- **Provider-backed 核心**：本地和在线走完全相同的代码路径（Qwen 负责解析
  / 报告，Bitget Playbook 负责回测）。
- **可回放的样本运行**：即便外部 API 抖动，Demo 也能稳定演示。
- **确定性、可解释的风险评分**：LLM 只用于解析和报告，不参与最终的安全
  决策。

## 渠道

| 渠道 | 角色 | 主要用途 |
|---|---|---|
| **Web UI** | 主 Demo + 可视化界面 | 发起运行、查看时间线 / 风险账本 / 审批 / 报告 / 仪表盘 |
| **Telegram Bot** | 触发 + 审批渠道 | 聊天里提交策略、审批 / 拒绝运行、收报告摘要 |

Web UI 是**主界面**。Telegram Bot 是**互补渠道**，用来证明"多渠道、人在
回路"的治理能力。

## 为什么选择 Eve 框架

TradeTrace 刻意建立在 [Eve](https://eve.dev) agent 框架之上，而不是自己撸一套
编排层。原因如下：

1. **Eve 的原语和我们的产品模型 1:1 对应**。Eve 的 `tools/`、`skills/`、
   `subagents/`、`channels/`、`schedules/` 正好对应 TradeTrace 需要的模块：
   Qwen 解析、Playbook 适配、风险引擎、Trace 存储、回放；风险账本规则、
   报告格式；Trace 分析师、风险官、事件报告员；Web 和 Telegram 入口；模拟
   盘监控器。这让项目能对齐一个成熟的心智模型，而不是重新发明轮子。
2. **自带可观测性**。Eve 暴露的工具调用和工作流 turn 遥测，恰好是"飞行
   记录器"需要的：谁在什么时候、用什么输入、产出了什么输出、花了多久。
3. **天然支持多渠道**。Eve 的 `channels/` 抽象就是 Web 入口和 Telegram Bot
   最自然的归属。它们共享同一个 `Run` 和 `Event` 存储，这也是 TradeTrace
   的核心不变式——在 Telegram 里发起的运行，必须在 Web UI 里看得见、能审批，
   反之亦然。
4. **Schedules 适合放模拟盘监控**。Eve 的 `schedules/` 是将来放周期性的
   模拟盘状态检查、每日运行摘要最干净的地方。
5. **工作流稳定优先于框架锁定**。当某个 beta 特性不稳定时，对应的职责
   就放到普通的 TypeScript 模块里，保证产品仍然能用。Eve 用来做它稳定的
   那部分：tools、workflow、channels、可观测性。

Eve 被当作编排骨架来用，不是贴个标签——具体到文件级的映射见
[PLAN.md §3 Eve 映射](PLAN.md)。

## 关于 Hackathon（以及之后）

项目的第一波具体形态来自 Bitget AI Hackathon
（<https://bitget-ai.gitbook.io/hackathon>）的 Track 2（Infra）。这次黑客松
提供了：

- 清晰的问题切入点：智能体交易基础设施，不是又一个聊天机器人。
- 一组真实可对接的 API（Bitget Playbook 做回测，Bitget Agent Hub 的技能
  persona 做证据，Qwen 做解析 / 报告）。
- 一个短时间窗口里必须把 MVP 跑起来的硬约束。

但这个项目**不是**一个冲着奖项去的 Demo。Hackathon 是火花，不是终点：

- 风险模型、事件模型、审批闸门都设计成能在赛后继续有用。
- Web UI 和 Telegram Bot 是真实的产品形态，不是搭给评委看的舞台。
- `samples/` 里的 fixture 让系统在没 API 时也能演示——这个属性比任何一次
  Demo 时段都更耐久。
- 基于 Eve 的架构是刻意做成可扩展的：模拟盘 live 模式、OpenTelemetry 风
  格的 trace ID、Webhook 告警、多智能体 CI/CD 都是计划中的下一步，不是
  "如果还有时间"的 TODO。

如果你是赛后再打开这个仓库：Quick Start 一样能跑，sample 一样能回放，
风险账本的规则一样适用。

## 快速开始

```bash
cp .env.example .env
# 填入 QWEN_API_KEY 和 PLAYBOOK_ACCESS_KEY（以及可选的 Telegram 配置）
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

本地和在线走完全相同的 provider-backed 代码路径。没有 `QWEN_API_KEY` 和
`PLAYBOOK_ACCESS_KEY` 时，"新建运行"会回退到 replay / sample 模式——可以
看 UI，但不能产出新的证据。

## 一次运行的完整流程

```text
自然语言策略 -> Qwen 解析 -> Bitget Skill 证据包 -> Playbook 回测
              -> 风险账本 -> 审批闸门
                              |
                              v
   运行后报告 <- 回放 / 执行 <- 模拟盘或 replay 运行 <- 决策
```

### 证据包（Evidence Pack）技能优先级

1. `technical-analysis` — 最高优先级，验证策略触发条件是否与图表背景吻合。
2. `sentiment-analyst` — 执行前的人群 / 情绪风险信号。
3. `news-briefing` — 抓标题面 / 监管 / 交易所层面冲击。
4. `market-intel` — 流动性 / 波动率 / 背景信号，纳入审计轨迹。
5. `macro-analyst` — 低频否决层（CPI / FOMC / 利率风险）。

公开文档里这五个 Skill Hub 技能没有暴露固定的 REST 接口。证据包用 Qwen
模拟这五个 persona，让本地和部署后的行为完全一致。Bitget 之后如果开放
官方可调用的技能端点或 MCP client binding，替换点在
`agent/tools/bitget-skill-evidence.ts`。

## Demo 场景

### 健康策略

```text
当 BTC 1h 周期 EMA20 上穿 EMA50、且 RSI 由 45 上穿到 55 时做多。
止损 1.5%，止盈 4%，最大仓位 15%，连续亏损两次后暂停。
```

预期路径：解析 → 回测 → 低风险 → 回放 → 报告。

### 危险策略

```text
只要价格下跌就不断加仓直到反弹。用高杠杆尽快把亏损赚回来。
```

预期路径：解析 → 回测 → 高风险 → 拦截 → 事件报告。

## API

```text
GET  /api/runs
POST /api/runs
GET  /api/runs/:runId
POST /api/runs/:runId/approve
POST /api/runs/:runId/reject
POST /api/runs/:runId/report
POST /api/telegram
```

## 项目结构

```text
.
├── README.md / README.zh.md
├── PRD.md    / PRD.zh.md
├── PLAN.md   / PLAN.zh.md
├── agent/
│   ├── instructions.md        # 智能体身份 & 安全边界
│   ├── agent.ts               # 主运行生命周期
│   ├── tools/                 # Qwen 解析、Playbook、风险、Trace、回放、证据
│   ├── skills/                # 风险账本规则、报告格式
│   ├── subagents/             # trace 分析师、风险官、事件报告员
│   ├── channels/              # web + telegram 入口
│   └── schedules/             # P1 模拟盘监控
├── app/                       # Next.js Web UI
├── lib/                       # 共享类型、风险规则、敏感信息脱敏
├── samples/                   # 回放 fixture（run-success、run-blocked）
└── data/                      # 本地运行 / 事件存储
```

## 安全说明

- MVP **不会**执行真实资金的交易。
- 任何样本运行、日志、Web UI **都不会**保存或显示密钥。
- 无论本地还是部署环境，新建运行都走 provider-backed 路径；没配置 key
  的时候，应用只服务 replay / sample 数据。
- 风险评分是**基于规则、可解释的**。LLM 只负责解析和报告，不参与最终
  安全决策。

## 许可证

开源 — 见 [LICENSE](LICENSE)。
