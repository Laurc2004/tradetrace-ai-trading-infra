# TradeTrace — Flight Recorder for AI Trading Agents

> An open-source AI trading infrastructure: record *why* an agent acted, backtest the strategy on real market data, score risk, gate execution, and keep the whole run replayable.
>
> 中文版: [README.md](README.md)

TradeTrace turns every AI trading-agent run into a replayable, auditable trail:

```text
NL strategy → Qwen parse → Bitget Skill Evidence Pack → Local deterministic backtest (real Bitget public klines)
            → Risk Ledger → Approval Gate → Paper / Replay execution → Post-run Report
```

> **This project is itself an AI trading infrastructure.** Out of the box it provides the full governance backbone — record → backtest → risk-gate → approve → execute → report → replay. Treat it as a scaffold and swap any link for your own implementation: the parser, data source, execution adapter, and notification channels are all hot-pluggable — see [As infrastructure: adapt & integrate](#as-infrastructure-adapt--integrate).

![TradeTrace landing](samples/screenshot-landing.webp)

AI trading agents are powerful but unsafe as black boxes — you can't see *why* a decision was made, and tool calls, backtests, risk checks, approvals, and execution are scattered everywhere, with no way to replay a failed run. TradeTrace is the missing governance layer between autonomous agents and trading execution: **a black box + cockpit voice recorder for trading-agent runs.**

Core stance: **risk scoring is rule-based, deterministic, and explainable; LLMs are used for parsing and reporting only — never for the final safety decision. Backtest metrics are computed on Bitget's official public market data — real and reproducible, never fabricated.**

The project originated from the [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) Track 2 (Trading Infra), but is designed to keep growing as general infrastructure past the event.

---

## 🏆 Submission (Hackathon)

> Track: **🟩 Trading Infra**

### Part 1 · Idea

**Pain point**: AI trading agents are powerful but unsafe as black boxes. An autonomous agent that can "sense the market → form a strategy → place orders → manage risk" is impossible to debug once it goes wrong — you can't see *why* it acted. Tool calls, backtests, risk checks, approvals, and execution are scattered across logs / dashboards / chats, with no standard audit trail scoped to a single run, and no clean way to replay a failed or dangerous run for review.

**Solution**: TradeTrace (a black box + cockpit voice recorder for trading agents) fills the missing governance layer between autonomous agents and trading execution, turning every run into a replayable, auditable trail:

```text
NL strategy → Qwen parse → Bitget Skill Evidence Pack → Local deterministic backtest (real Bitget public klines)
            → Rule-based Risk Ledger → Human-in-the-loop Approval Gate → Paper / Replay execution → Post-run Report
```

Three key design decisions:

1. **Risk scoring is rule-based, deterministic, and explainable** — the LLM only parses the strategy and writes the report; it never makes the final safety decision;
2. **The backtest runs on Bitget's official public market data — real and reproducible** — it hits `https://api.bitget.com/api/v2/spot/market/candles` (the same endpoint behind Agent Hub's `spot_get_candles` / `futures_get_candles`), never fabricated;
3. **The default execution layer is a replay adapter that explicitly sends no real orders**, and there is always an auditable gate before execution.

### Part 2 · Completion

**Done**: the full governance backbone — record → backtest → risk-gate → approve → execute → report → replay; two entry points (Web UI + Telegram bot, sharing one Run store); a deterministic rule-based risk engine (blocks martingale / high-leverage / missing-stop-loss strategies, with decisions degrading to Go / Review / Block); a local deterministic backtest engine (EMA cross / RSI / momentum, bar-close simulation, real PnL / Sharpe / drawdown / win-rate); a flight-recorder-style timeline, human-in-the-loop approval, post-run reports, and structured on-disk logs. Every core capability sits behind a clean tool boundary ([agent/tools/](agent/tools/)) with an explicit swap point, so the whole thing works as a scaffold for further development.

**Problems hit & how they were solved**:

- The official Playbook was unreachable → switched to a **local deterministic backtest**, which turned out *more* reproducible (judges can verify with one `npm run reproduce`);
- The five Skill Hub skills expose no fixed REST endpoint → **simulated the five personas with Qwen** so local and deployed behavior match, with a clean swap point left open;
- Tempted to silently degrade when a backtest fails → insisted on an **explicit `failed` status** surfaced in the UI with the real cause, never masked.

**Not yet done / next**: a real order adapter (default is replay, explicitly no real orders); WebSocket private market data and depth; Playbook / Agent Hub orchestration; an MCP server wrapper.

**Stack & Bitget tools**: Next.js (App Router, TypeScript), Qwen (strategy parsing + report, via the Bitget proxy `qwen3.6-plus`), Zod. **The `agent/` directory follows the [Vercel Eve](https://vercel.com/eve) "an agent is a directory" file convention** (`agent.ts` + `instructions.md` + `tools/ / skills/ / subagents/ / channels/ / schedules/`), making it straightforward to drop in the Eve runtime later; today the run lifecycle is orchestrated by Next.js + a hand-written `agent.ts`. **Bitget tools**: direct calls to Bitget **public market API** (same source as Agent Hub's `spot_get_candles` / `futures_get_candles`, no key needed for backtest); the evidence pack's skill priority is modeled on the **Skill Hub**'s five analyst personas.

**One-command reproduction for judges**: `npm run reproduce` loads the already-parsed strategy from a sample fixture, feeds it to the same engine the app uses at runtime, replays it over real Bitget public klines, and prints the result next to the recorded values (trade count / win rate / max drawdown match exactly). See [Logs & reproducibility](#logs--reproducibility).

### Part 3 · Thoughts on AI Trading (optional)

The real bottleneck for Agentic Trading isn't "can it place orders autonomously" — model capability is already there — it's **trust and accountability**. An agent that runs while you sleep, but can't answer "why did it do that", will never touch real money. Building TradeTrace convinced me the core of this generation of AI trading infra isn't a smarter strategy but making the *why* explicit: explainable risk, replayable trails, human-in-the-loop gates. That's the layer LLMs must cross to go from "demo" to "production agent".

---

## What problem it solves

The official Track 2 (Trading Infra) judging criterion, verbatim: **"Can other developers actually integrate it with low friction; does it genuinely solve a pain point rather than reproducing existing tools."** TradeTrace targets the missing layer for AI trading agents — **observability, auditability, approval, replay, and post-run analysis**:

- You can't see *why* an agent made a decision.
- Tool calls, backtest output, risk checks, approvals, and execution events are scattered across logs / dashboards / chats.
- There is no **standard audit trail scoped to a single run**.
- Risk gates are often implicit, or missing entirely.
- Failed or dangerous runs can't be cleanly replayed or reviewed.

TradeTrace is not another trading chatbot or strategy generator. It records the full lifecycle of one trading-agent run so it can be replayed.

---

## Install

### Prerequisites

- **Node.js ≥ 18.17** (Next.js requirement; 20 LTS recommended)
- **npm** (ships with Node)
- Internet access: needs the Qwen API; backtesting hits Bitget public market endpoints (**no Bitget key required**)

### 1. Clone & install

```bash
git clone <repo-url>
cd bitget-hackathon-infra
npm install
```

### 2. Configure env

```bash
cp .env.example .env
```

Open `.env` and fill it in. **Only `QWEN_API_KEY` is required** — backtesting uses Bitget's public market endpoints and needs no Bitget key.

| Var | Required | Notes |
|---|---|---|
| `QWEN_API_KEY` | **yes** | Qwen API key for strategy parsing + post-run reports. The hackathon issues one (via the Bitget proxy base url); you can also use your own Qwen key. |
| `QWEN_BASE_URL` | default set | Qwen endpoint (hackathon proxy: `https://hackathon.bitgetops.com/v1`). |
| `QWEN_MODEL` | default set | Model name (`qwen3.6-plus`). |
| `TELEGRAM_BOT_TOKEN` | optional | Leave empty to run Web UI only; set to enable the Telegram bot. |
| `NEXT_PUBLIC_APP_URL` | optional | Used to build run links returned by the Telegram API. Defaults to `http://localhost:3000`. |

> **Backtesting needs no Bitget key.** The local deterministic backtest engine ([agent/tools/local-backtest.ts](agent/tools/local-backtest.ts)) calls Bitget's public kline endpoint `https://api.bitget.com/api/v2/spot/market/candles` directly — the same endpoint the Agent Hub `spot_get_candles` / `futures_get_candles` skills hit. Public, unauthenticated.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Even without `QWEN_API_KEY`, the app still serves the bundled [sample runs](#sample-inputs--outputs-reproducible-without-any-api).

### Optional: check / build

```bash
npm run typecheck   # TypeScript type check
npm run build       # production build
npm run start       # run in production mode
```

---

## Quick start

1. `npm install && cp .env.example .env`, fill in `QWEN_API_KEY`.
2. `npm run dev`, open [http://localhost:3000/runs/new](http://localhost:3000/runs/new).
3. Paste a natural-language strategy (or use a template) and start — the console streams Qwen parse, Evidence Pack, local backtest, risk score, approval, and report events live.
4. Browse the two captured real runs in [samples/](samples/) (healthy +8.3% / dangerous blocked), reproducible with no API.

---

## Channels

Two entry points share **one run store** — a run started in Telegram is visible and approvable in the Web UI, and vice versa.

### A. Web UI (primary)

- Pages (**English-only, flat routes**):
  - `/` — landing
  - `/runs/new` — new run (paste an NL strategy, streaming console)
  - `/runs/<runId>` — run detail: Flight Recorder timeline, Risk Ledger, backtest evidence, approval buttons, post-run report
  - `/dashboard` — dashboard
- When a run reaches `awaiting_approval`, the detail page shows **Approve / Reject** buttons (human-in-the-loop).

**New run page** (paste an NL strategy; the right-hand Live pipeline tracks the six stages in real time):

![New run page](samples/screenshot-newrun.webp)

**Run detail page** (Flight Recorder timeline, Risk Ledger, backtest evidence, approval buttons, post-run report):

![Run detail page](samples/screenshot-rundetail.webp)

### B. Telegram Bot (complementary)

**You don't need a real Telegram connection locally** — you can simulate the webhook (see [Examples](#examples)). Real setup:

1. Create a bot via [@BotFather](https://t.me/BotFather), put `TELEGRAM_BOT_TOKEN` in `.env`.
2. Deploy publicly (e.g. Vercel) and set `NEXT_PUBLIC_APP_URL` to your domain.
3. Set the webhook:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-domain/api/telegram"
   ```

4. Register the command menu (so `/run` etc. show up in the command autocomplete):

   ```bash
   npm run telegram:register
   ```

5. Use commands in Telegram:

   ```text
   /run <NL strategy>        # start a run (streams stages; shows Approve/Reject buttons at the approval step)
   /status <run_id>          # query status and decision
   /report <run_id>          # fetch report summary
   ```
   Approval is done via the inline **Approve / Reject** buttons on the `/run` result message (no command needed).

---

## As infrastructure: adapt & integrate

TradeTrace isn't just a hackathon demo — it's designed as **a reusable, adaptable AI trading infrastructure.** Every core capability lives behind a cleanly bounded tool module ([agent/tools/](agent/tools/)), and each layer has an explicit swap point. The most common adaptation paths are below.

### Swappable extension points

| Capability | Current implementation | Swap point |
|---|---|---|
| Strategy parsing (NL → structured) | Qwen | [agent/tools/qwen-strategy-parser.ts](agent/tools/qwen-strategy-parser.ts) |
| Market Evidence Pack | Qwen simulating 5 Skill personas | [agent/tools/bitget-skill-evidence.ts](agent/tools/bitget-skill-evidence.ts) |
| Backtest engine | Local deterministic backtest (Bitget public klines) | [agent/tools/local-backtest.ts](agent/tools/local-backtest.ts) |
| Risk scoring | Rule-based, deterministic, explainable | [agent/tools/risk-engine.ts](agent/tools/risk-engine.ts) |
| Approval gate | Web UI + Telegram (human-in-the-loop) | [agent/tools/approval-gate.ts](agent/tools/approval-gate.ts) |
| Execution layer | replay adapter (**sends no real orders**) | `executeReplay` in [agent/agent.ts](agent/agent.ts) |
| Notification channels | Web / Telegram | [agent/channels/](agent/channels/) |

As long as you honor the type contracts in [lib/types.ts](lib/types.ts) (`StructuredStrategy`, `BacktestResult`, `RiskAssessment`, `Report`, etc.), you can replace any one layer with your own implementation while the run store, timeline, replay, audit, and report generation are **all reused automatically**.

### 1. Integrate Playbook (Bitget Agent Hub orchestration)

The run lifecycle is currently wired in code (parse → backtest → risk → approve → execute). To orchestrate it with **Bitget Playbook / Agent Hub**, migrate the stage calls in [agent/agent.ts](agent/agent.ts) into Playbook step definitions — each `agent/tools/*.ts` is a stateless pure function you can register directly as a Playbook tool / step. Run-bundle reads/writes still go through [lib/store.ts](lib/store.ts), so audit and replay are preserved.

### 2. Integrate Bitget official API / Skills

- **Market data**: backtesting currently hits Bitget's public kline endpoint (unauthenticated). For private feeds, WebSocket streams, or order-book depth, add a Bitget API key and swap the data source in [agent/tools/local-backtest.ts](agent/tools/local-backtest.ts).
- **Execution**: the default execution layer is a replay adapter that **explicitly sends no real orders**. To trade live, implement an adapter at `executeReplay` that calls Bitget's order endpoint (`/api/v2/trade/place-order`), and **keep the approval gate + risk pre-check** — that's the whole point of TradeTrace as a black box.

### 3. Integrate MCP (Model Context Protocol)

The parser, evidence pack, and report generator are isolated tool calls — ideal for wrapping as **MCP tools** exposed to any MCP client (Claude Desktop, Cursor, Codex, …). Minimal change: wrap modules like [agent/tools/qwen-strategy-parser.ts](agent/tools/qwen-strategy-parser.ts) in an MCP server, reusing the schemas from [lib/types.ts](lib/types.ts) directly as tool input/output schemas. Conversely, you can make TradeTrace an MCP *client* and call external MCP servers (market data / news / on-chain tools) to enrich the Evidence Pack.

### 4. Integrate getclaw / third-party Hermes / OpenClaw

Both the execution and channel layers are adapter-shaped, ready to connect to community trading-execution frameworks and message buses:

- **getclaw / OpenClaw** (execution frameworks): implement an `executeXxx(runId)` adapter replacing `executeReplay`, translating TradeTrace's decision (Go / Review / Block + structured strategy) into the target framework's order/position semantics. The risk score and approval state travel with the run bundle, so **an auditable gate always sits in front of execution**.
- **Hermes** and similar message / event buses: [agent/channels/](agent/channels/) already ships `web` and `telegram` channel adapters; add a Hermes channel to push run events (stage transitions, approval requests, report-ready) onto your bus, or to receive run-trigger commands from it.

> Design principle: **no matter which execution / data / messaging backend you plug in, the governance chain stays constant — replayable, auditable, risk-gated, human-in-the-loop.** You're only swapping "hands and eyes"; the black box itself is stable.

---

## Examples

> The `curl` commands assume `npm run dev` is running on `localhost:3000` and `QWEN_API_KEY` is set.

### Example 1: start a run (healthy strategy)

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"strategy":"Short BTCUSDT on 1h timeframe using EMA12 crossing below EMA26 as the entry, with a 2% stop loss and 5% take profit. Trend-following short only."}'
```

Expect a `RunBundle` with `run.status = awaiting_approval`, `backtest.provider = local_deterministic`, and `backtest.pnl` computed from real Bitget klines (not fabricated). A per-run log folder is written under `logs/<runId>/<timestamp>/`.

### Example 2: query run detail

```bash
curl http://localhost:3000/api/runs/<runId>
```

Returns the full bundle (timeline events, risk ledger, backtest with explainable `backtest.notes`, report).

### Example 3: approve / reject (human-in-the-loop)

```bash
# approve (only when status is awaiting_approval)
curl -X POST http://localhost:3000/api/runs/<runId>/approve \
  -H 'content-type: application/json' -d '{"reason":"checked risk ledger"}'

# reject
curl -X POST http://localhost:3000/api/runs/<runId>/reject \
  -H 'content-type: application/json' -d '{"reason":"drawdown too high"}'
```

### Example 4: dangerous strategy (blocked)

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"strategy":"Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible."}'
```

Expect: `risk.level = High`, `score = 100`, `recommendation = Block`, `run.status = blocked`. The risk ledger lists the critical rules hit (`no-martingale` critical, `high-leverage`, `missing-stop-loss`).

### Example 5: simulate a Telegram webhook locally

```bash
curl -X POST http://localhost:3000/api/telegram \
  -H 'content-type: application/json' \
  -d '{"message":{"chat":{"id":1},"text":"/run Short BTCUSDT when EMA12 crosses below EMA26, 2% stop loss, 5% take profit."}}'
```

Returns a `sendMessage`-shaped JSON with the created `run_id` and link.

---

## Logs & reproducibility

### One-command reproduction for judges (no API needed)

Backtest results are not accepted as plain screenshots — the code that produced
them ships with the repo and can be reproduced. There is one built-in command:

```bash
npm run reproduce
```

It loads the **already-parsed strategy** from the sample fixture
[`samples/run-success.json`](samples/run-success.json), feeds it to the *same*
engine the app uses at runtime (`runLocalBacktest` in
[agent/tools/local-backtest.ts](agent/tools/local-backtest.ts)), replays it over
**real Bitget public klines** (BTCUSDT, 1h), and prints the freshly-computed
metrics next to the values recorded in the fixture:

```text
metric                   reproduced       recorded
pnl (%)                         7.5            8.3
sharpe                         2.65           2.95
max drawdown (%)               6.95           6.95
win rate (%)                   31.8           31.8
trade count                      22             22
```

The deterministic parts (trade count, win rate, max drawdown) match exactly;
PnL/Sharpe drift as real market data advances (the fixture was captured on
2026-06-20, the re-run pulls the latest klines) — **that is real-data variance,
not fabrication**. Script: [scripts/reproduce-backtest.mts](scripts/reproduce-backtest.mts);
no Qwen key, no Bitget key required.

### Run logs (timestamped, with call counts)

**Every run writes a structured log locally**, grouped by run + timestamp:

```text
logs/
  run_001_a1b2c3/                 # grouped by runId (multiple lifecycles of one run cluster here)
    20260618-080322/              # this lifecycle's timestamp (UTC)
      run.log                     # NDJSON, one structured log line per entry
      summary.json                # call metadata + per-scope call counts
```

- **`run.log`**: one JSON per line — `ts` (ISO), `level`, `scope`, `message`, plus provider fields like `status` / `attempt` / `url` / `model`. All sensitive fields (key, token, Bearer) are redacted before writing.
- **`summary.json`**: aggregates `call_counts_by_scope` and `total_log_calls`, so you can see at a glance how many Qwen / local-backtest calls this run made.

> These logs are **generated by code at runtime**, not hand-written. `logs/` is in `.gitignore` — a judge running `npm run dev` and any example above will see real logs under `logs/`.

### Sample inputs + outputs (reproducible without any API)

`samples/` ships two full input→output reproductions:

- **Inputs**: [`samples/strategies.md`](samples/strategies.md) — the two raw strategies (healthy / dangerous).
- **Outputs**: [`samples/run-success.json`](samples/run-success.json) (trend short, **+8.3% PnL / Sharpe 2.95**, Review→approved→completed) and [`samples/run-blocked.json`](samples/run-blocked.json) (martingale + high leverage, High/100, blocked).

Both are complete `RunBundle` objects **captured from real local backtests** (provenance recorded in `backtest.notes`). Stored as `backtest.provider = replay_fixture` for offline replay, but the metrics are **not fabricated**. `GET /api/runs` lists these samples too, so the app is demoable with no key.

---

## One run, end to end

```text
NL strategy -> Qwen parse -> Bitget Skill Evidence Pack -> Local deterministic backtest (real Bitget public klines)
              -> Risk Ledger -> Approval Gate
                              |
                              v
   Post-run Report <- Replay / execution <- paper or replay run <- decision (Go / Review / Block)
```

### Backtest engine (local, deterministic, real data)

[agent/tools/local-backtest.ts](agent/tools/local-backtest.ts):

1. Calls Bitget's public kline endpoint for historical OHLCV (BTCUSDT etc., `1h` granularity, no key), cached to `data/klines-cache/` for reproducibility.
2. Interprets the Qwen-parsed `StructuredStrategy` into executable rules (EMA cross / RSI / momentum), honoring stop-loss / take-profit / direction.
3. Runs a **deterministic per-bar simulation** over the series (single position, fractional sizing, bar-close evaluation) to produce real PnL / Sharpe / max-drawdown / win-rate / trade-count.
4. **Is honest**: this is a replay simulation on public data, not live exchange matching. Every backtest's `backtest.notes` records the interpretation and data source.

Backtest failures are **never silently degraded** — they surface as `status: 'failed'` with the real reason (e.g. kline fetch failed) shown in the UI.

### Evidence Pack skill priority

1. `technical-analysis` — highest priority; validates that strategy triggers match chart context.
2. `sentiment-analyst` — pre-execution crowd / sentiment risk.
3. `news-briefing` — headline / regulatory / exchange-level shocks.
4. `market-intel` — liquidity / volatility / background signals.
5. `macro-analyst` — low-frequency veto layer (CPI / FOMC / rate risk).

Bitget does not expose a fixed REST surface for these five Skill Hub skills, so the Evidence Pack simulates the five personas with Qwen, keeping local and deployed behavior identical. When Bitget opens callable skill endpoints, the swap point is [agent/tools/bitget-skill-evidence.ts](agent/tools/bitget-skill-evidence.ts).

---

## API cheat sheet

```text
GET  /api/runs                  # list all runs (incl. samples)
POST /api/runs                  # start a run   body: {"strategy": "...", "market"?: "..."}
POST /api/runs/stream           # streaming start (NDJSON progress)
GET  /api/runs/:runId           # run detail
POST /api/runs/:runId/approve   # approve       body: {"reason": "..."}
POST /api/runs/:runId/reject    # reject        body: {"reason": "..."}
POST /api/runs/:runId/report    # generate / refresh report
POST /api/telegram              # Telegram webhook entry
```

---

## Project structure

```text
.
├── README.md / README.en.md
├── .env.example                # env template (only QWEN_* required; backtest needs no Bitget key)
├── agent/                     # follows the Vercel Eve "an agent is a directory" convention
│   ├── agent.ts                # main run lifecycle (startRun / approve / reject / execute)
│   ├── instructions.md         # agent identity & safety bounds
│   ├── tools/
│   │   ├── local-backtest.ts   # local deterministic backtest engine (Bitget public klines, pure TS)
│   │   ├── qwen-strategy-parser.ts
│   │   ├── bitget-skill-evidence.ts
│   │   ├── risk-engine.ts      # deterministic, explainable risk rules
│   │   ├── approval-gate.ts
│   │   ├── report-generator.ts
│   │   └── trace-event.ts
│   ├── skills/ subagents/ channels/ schedules/
├── app/                        # Next.js App Router (flat routes, English)
│   ├── page.tsx runs/ dashboard/
│   └── api/                    # runs / telegram routes
├── components/                 # timeline / risk-ledger / evidence-pack / report-panel / approval-actions
├── lib/                        # types, env, store, redaction, logger (disk logs)
├── samples/                    # replay fixtures (captured from real backtests) + strategies.md
├── data/                       # local run/event store + kline cache (JSON, gitignored)
└── logs/                       # runtime per-run API call logs (gitignored)
```

---

## Security notes

- The MVP **never** executes real-money trades (the execution layer is a replay adapter that explicitly sends no real orders).
- No sample run, log, or Web UI view **ever** stores or shows secrets: logs pass through `redactObject`, `.env` is in `.gitignore`.
- Risk scoring is **rule-based and explainable**; LLMs only parse and report, never decide.
- Backtesting needs **no** Bitget key; only a missing `QWEN_API_KEY` blocks new runs, and the app still serves replay / sample data.

## License

Open source — see [LICENSE](LICENSE).
