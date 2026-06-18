# TradeTrace — AI 交易智能体的"黑匣子"

> 一个开源的 AI 交易基础设施：记录智能体"为什么这么做"、回测策略、量化风险、在执行前把关，并把整次运行完整地、可回放地保留下来。
>
> English: [README.en.md](README.en.md)

TradeTrace 把每一次 AI 交易智能体的运行都变成可回放、可审计的轨迹：

```text
自然语言策略 → Qwen 解析 → Bitget Skill 证据包 → GetAgent 回测
            → 风险账本 → 审批闸门 → 模拟 / 回放执行 → 运行后报告
```

AI 交易智能体能力很强，但作为黑盒是危险的——用户看不清它"为什么"做决策，工具调用、回测、风控、审批、执行散落各处，失败也无法复盘。TradeTrace 补的就是「自主智能体」和「交易执行」之间那层治理基础设施：**交易智能体版的黑匣子 + 驾驶舱语音记录器**。

核心立场：**风险评分是基于规则、确定性、可解释的；LLM 只负责解析和报告，绝不参与最终的安全决策。**

本项目源自 [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) Track 2（Infra），但设计为赛后可继续生长的通用基础设施。

---

## 目录

- [安装](#安装)
- [接入方式](#接入方式)
- [使用示例](#使用示例)
- [运行日志与复现](#运行日志与复现)
- [一次运行的流程](#一次运行的流程)
- [API 速查](#api-速查)
- [项目结构](#项目结构)
- [安全说明](#安全说明)

---

## 安装

### 前置要求

- **Node.js ≥ 18.17**（Next.js 要求；推荐 20 LTS）
- **npm**（随 Node 附带）
- 可访问外网：需要调用 Qwen 和 Bitget 接口

### 1. 克隆并安装依赖

```bash
git clone <repo-url>
cd bitget-hackathon-infra
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

打开 `.env`，按下表填写。**只有 `QWEN_API_KEY` 和 `BITGET_API_KEY` 是必填**——没有它们无法新建运行（Web UI 仍可浏览内置样本）。

| 变量 | 是否必填 | 说明 |
|---|---|---|
| `QWEN_API_KEY` | **必填** | Qwen 的 API Key，用于解析策略 + 生成运行后报告。 |
| `QWEN_BASE_URL` | 已给默认值 | Qwen 接口地址。 |
| `QWEN_MODEL` | 已给默认值 | 使用的模型名。 |
| `BITGET_API_KEY` | **必填** | Bitget GetAgent / Playbook 的访问 Key，作为 `ACCESS-KEY` header 调用回测。 |
| `BITGET_SECRET_KEY` | 可选 | 预留给签名接口；**当前代码未读取**，留作将来扩展。 |
| `BITGET_PASSPHRASE` | 可选 | 同上，预留。 |
| `TELEGRAM_BOT_TOKEN` | 可选 | 留空则只跑 Web UI；填了才启用 Telegram bot。 |
| `NEXT_PUBLIC_APP_URL` | 可选 | 用于拼 Telegram 返回的 run 链接。本地默认 `http://localhost:3000`。 |

> 说明：本地和线上走**完全相同的代码路径**。回测接口失败时，系统会记录 `getagent.backtest.failed` 并转入降级评估，继续产出风险账本和报告，不会中断。

### 3. 启动

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)（默认跳转到 `/zh`）。

### 可选：检查 / 构建

```bash
npm run typecheck   # TypeScript 类型检查
npm run build       # 生产构建
npm run start       # 以生产模式启动
```

---

## 接入方式

系统有两个入口，**共享同一份 Run 存储**——在 Telegram 发起的运行，在 Web UI 里同样看得见、能审批，反之亦然。

### A. Web UI（主界面）

- 路由：`/zh/...`（中文，默认）、`/en/...`（英文）。根路径 `/` 会 307 跳转到 `/zh`，右上角 `中 / EN` 切换。
- 页面：
  - `/zh` — 落地页
  - `/zh/runs/new` — 新建运行（粘贴自然语言策略）
  - `/zh/runs/<runId>` — 运行详情：飞行记录器时间线、风险账本、审批按钮、运行后报告
  - `/zh/dashboard` — 仪表盘
- 运行进入 `awaiting_approval` 状态时，详情页会出现 **Approve / Reject** 按钮（人在回路）。

### B. Telegram Bot（互补渠道）

**本地无需真的接 Telegram**，也能模拟 webhook（见下方[使用示例](#使用示例)）。真实接入步骤：

1. 在 [@BotFather](https://t.me/BotFather) 创建 bot，拿到 `TELEGRAM_BOT_TOKEN`，填进 `.env`。
2. 部署到公网（如 Vercel），并把 `NEXT_PUBLIC_APP_URL` 设为部署域名。
3. 设置 webhook：

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://你的域名/api/telegram"
   ```

4. 在 Telegram 里使用命令：

   ```text
   /run <自然语言策略>        # 发起一次运行
   /status <run_id>          # 查询状态
   /approve <run_id>         # 批准执行
   /reject <run_id> <原因>   # 拒绝执行
   /report <run_id>          # 拉取报告摘要
   ```

> 注意：Telegram 返回的 run 链接形如 `https://域名/runs/<runId>`（不带 locale 前缀，便于机器人/curl 稳定访问）。在浏览器里可手动加 `/zh` 或 `/en` 前缀查看本地化页面。

---

## 使用示例

> 以下 `curl` 命令假设服务已 `npm run dev` 跑在 `localhost:3000`，且已配置 `QWEN_API_KEY` 和 `BITGET_API_KEY`。API 路由**不带 locale 前缀**。

### 示例 1：发起一次运行（健康策略）

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"strategy":"当 BTC 1h EMA20 上穿 EMA50、且 RSI 由 45 上穿到 55 时做多。止损 1.5%，止盈 4%，最大仓位 15%，连续亏损两次后暂停。"}'
```

期望返回一个 `RunBundle`，其中 `run.status` 为 `completed`/`awaiting_approval`/`blocked`，`risk.level` 为 `Low`，`final_decision` 为 `Go`。同时会在 `logs/<runId>/<时间戳>/` 下生成运行日志（见下节）。

### 示例 2：查询运行详情

```bash
curl http://localhost:3000/api/runs/<runId>
```

返回该 run 的完整 bundle（含时间线事件、风险账本、回测、报告）。

### 示例 3：审批 / 拒绝（人在回路）

```bash
# 批准（仅当状态为 awaiting_approval 时生效）
curl -X POST http://localhost:3000/api/runs/<runId>/approve \
  -H 'content-type: application/json' -d '{"reason":"checked risk ledger"}'

# 拒绝
curl -X POST http://localhost:3000/api/runs/<runId>/reject \
  -H 'content-type: application/json' -d '{"reason":"drawdown too high"}'
```

### 示例 4：危险策略（被拦截）

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"strategy":"只要价格下跌就不断加仓直到反弹。用高杠杆尽快把亏损赚回来。"}'
```

期望：`risk.level = High`、`recommendation = Block`、`run.status = blocked`、`final_decision = Block`。

### 示例 5：本地模拟 Telegram webhook

```bash
curl -X POST http://localhost:3000/api/telegram \
  -H 'content-type: application/json' \
  -d '{"message":{"chat":{"id":1},"text":"/run 当 BTC 1h EMA20 上穿 EMA50 时做多，止损 1.5%，最大仓位 15%。"}}'
```

返回一个 `sendMessage` 形式的 JSON，含创建的 `run_id` 和链接。

---

## 运行日志与复现

### 运行日志（含时间戳与调用量）

**每次运行都会在本地生成一份结构化日志**，按 run + 时间分目录存放：

```text
logs/
  run_001_a1b2c3/                 # 以 runId 分组（同一 run 的多次生命周期会聚在一起）
    20260618-080322/              # 本次生命周期的时间戳（UTC）
      run.log                     # NDJSON，每行一条带 ts 的结构化日志
      summary.json                # 本次调用的元信息 + 各 scope 的调用次数（调用量）
```

- **`run.log`**：每行一个 JSON，字段含 `ts`（ISO 时间戳）、`level`、`scope`、`message`，以及来自 provider 的 `status` / `attempt` / `duration` / `baseUrl` / `model` 等调用量字段。所有敏感字段（key、token、Bearer）会先经脱敏再写入。
- **`summary.json`**：聚合本次运行的 `call_counts_by_scope`（按 scope 统计调用次数）和 `total_log_calls`，便于一眼看出这次 run 各调用了几次 Qwen / GetAgent。

> 这些日志是**运行时由代码自动生成**的，不是手写示例。`logs/` 已加入 `.gitignore`，不会进仓库——评委在本地 `npm run dev` 跑一次上述任意示例，即可在 `logs/` 下看到真实日志。

`run.log` 单行格式（说明用，实际内容由运行生成）：

```json
{"ts":"2026-06-18T08:03:22.411Z","level":"info","scope":"qwen.strategy-parser","message":"chat completions returned","runId":"run_001_a1b2c3","baseUrl":"https://hackathon.bitgetops.com/v1","model":"qwen3.6-plus","status":200,"ok":true}
```

`summary.json` 格式（说明用，实际内容由运行生成）：

```json
{
  "run_id": "run_001_a1b2c3",
  "started_at": "2026-06-18T08:03:22.000Z",
  "ended_at": "2026-06-18T08:03:30.000Z",
  "log_file": "run.log",
  "call_counts_by_scope": {
    "qwen.strategy-parser": 2,
    "getagent.backtest": 4,
    "getagent.upload": 1,
    "getagent.run": 1,
    "getagent.poll": 3
  },
  "total_log_calls": 11
}
```

### 样本输入 + 输出（无需 API 即可复现）

`samples/` 提供两条完整的「输入 → 输出」复现材料：

- **输入**：[`samples/strategies.md`](samples/strategies.md)——两条策略原文（健康 / 危险）。
- **输出**：[`samples/run-success.json`](samples/run-success.json)（Low 风险，`Go`，completed）、[`samples/run-blocked.json`](samples/run-blocked.json)（High 风险，`Block`，blocked）。

两个输出文件都是完整的 `RunBundle`（`{ run, strategy, backtest, risk, approval, report, events, evidence }`），`backtest.provider = replay_fixture`，无论 API 是否可用都能稳定回放。`GET /api/runs` 会把这两个样本一并列出。

---

## 一次运行的流程

```text
自然语言策略 -> Qwen 解析 -> Bitget Skill 证据包 -> GetAgent 回测
              -> 风险账本 -> 审批闸门
                              |
                              v
   运行后报告 <- 回放 / 执行 <- 模拟盘或 replay 运行 <- 决策(Go / Review / Block)
```

### 证据包（Evidence Pack）技能优先级

1. `technical-analysis` — 最高优先级，验证策略触发条件与图表背景是否吻合。
2. `sentiment-analyst` — 执行前的人群 / 情绪风险信号。
3. `news-briefing` — 标题面 / 监管 / 交易所层面冲击。
4. `market-intel` — 流动性 / 波动率 / 背景信号。
5. `macro-analyst` — 低频否决层（CPI / FOMC / 利率风险）。

公开文档未给这五个 Skill Hub 技能暴露固定 REST 接口，因此证据包用 Qwen 模拟这五个 persona，使本地与部署后行为一致。Bitget 之后若开放官方可调用技能端点，替换点在 [agent/tools/bitget-skill-evidence.ts](agent/tools/bitget-skill-evidence.ts)。

---

## API 速查

API 路由不带 locale 前缀（Telegram webhook、curl、浏览器 fetch 都用稳定路径）：

```text
GET  /api/runs                  # 列出所有 run（含样本）
POST /api/runs                  # 发起一次运行  body: {"strategy": "...", "market"?: "..."}
POST /api/runs/stream           # 流式发起（NDJSON 进度流）
GET  /api/runs/:runId           # 运行详情
POST /api/runs/:runId/approve   # 批准  body: {"reason": "..."}
POST /api/runs/:runId/reject    # 拒绝  body: {"reason": "..."}
POST /api/runs/:runId/report    # 生成 / 刷新报告
POST /api/telegram              # Telegram webhook 入口
```

---

## 项目结构

```text
.
├── README.md / README.en.md
├── .env.example                # 环境变量模板（标注真实被读取的变量）
├── i18n/ + messages/           # next-intl 中英双语
├── proxy.ts                    # next-intl 路由代理
├── agent/
│   ├── agent.ts                # 主运行生命周期（startRun / approve / reject / execute）
│   ├── instructions.md         # 智能体身份 & 安全边界
│   ├── tools/                  # Qwen 解析、GetAgent 回测、风险、Trace、证据、报告、审批
│   ├── skills/                 # 风险账本规则、报告格式
│   ├── subagents/              # trace 分析师、风险官、事件报告员
│   ├── channels/               # web + telegram 入口
│   └── schedules/              # 模拟盘监控
├── app/
│   ├── [locale]/               # 本地化页面（/zh/..., /en/...）
│   └── api/                    # 路由不带 locale 前缀
├── lib/                        # 类型、env、store、redaction(脱敏)、logger(含日志落盘)
├── samples/                    # 回放 fixture + 输入策略说明（strategies.md）
├── data/                       # 本地运行 / 事件存储（JSON，gitignored）
└── logs/                       # 运行时按 run 生成的 API 调用日志（gitignored）
```

---

## 安全说明

- MVP **不会**执行真实资金的交易（执行层是 replay 适配器，明确不发送真实订单）。
- 任何样本运行、日志、Web UI **都不会**保存或显示密钥：日志经 `redactObject` 脱敏，`.env` 在 `.gitignore`。
- 风险评分是**基于规则、可解释的**；LLM 只负责解析和报告，不参与最终安全决策。
- 没有配置 `QWEN_API_KEY` / `BITGET_API_KEY` 时，无法新建运行；应用只服务 replay / sample 数据。

## 许可证

开源 — 见 [LICENSE](LICENSE)。
