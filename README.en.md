# TradeTrace — Flight Recorder for AI Trading Agents

> An open-source AI trading infrastructure: record *why* an agent acted, backtest the strategy on real market data, score risk, gate execution, and keep the whole run replayable.
>
> 中文版: [README.md](README.md)

TradeTrace turns every AI trading-agent run into a replayable, auditable trail:

```text
NL strategy → Qwen parse → Bitget Skill Evidence Pack → Local deterministic backtest (real Bitget public klines)
            → Risk Ledger → Approval Gate → Paper / Replay execution → Post-run Report
```

AI trading agents are powerful but unsafe as black boxes — you can't see *why* a decision was made, and tool calls, backtests, risk checks, approvals, and execution are scattered everywhere, with no way to replay a failed run. TradeTrace is the missing governance layer between autonomous agents and trading execution: **a black box + cockpit voice recorder for trading-agent runs.**

Core stance: **risk scoring is rule-based, deterministic, and explainable; LLMs are used for parsing and reporting only — never for the final safety decision. Backtest metrics are computed on Bitget's official public market data — real and reproducible, never fabricated.**

The project originated from the [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) Track 2 (Trading Infra), but is designed to keep growing as general infrastructure past the event.

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

### B. Telegram Bot (complementary)

**You don't need a real Telegram connection locally** — you can simulate the webhook (see [Examples](#examples)). Real setup:

1. Create a bot via [@BotFather](https://t.me/BotFather), put `TELEGRAM_BOT_TOKEN` in `.env`.
2. Deploy publicly (e.g. Vercel) and set `NEXT_PUBLIC_APP_URL` to your domain.
3. Set the webhook:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-domain/api/telegram"
   ```

4. Use commands in Telegram:

   ```text
   /run <NL strategy>        # start a run
   /status <run_id>          # query status
   /approve <run_id>         # approve execution
   /reject <run_id> <reason> # reject execution
   /report <run_id>          # fetch report summary
   ```

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
├── agent/
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
