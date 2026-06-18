# TradeTrace — Flight Recorder for AI Trading Agents

> An open-source AI trading infrastructure: record *why* an agent acted, backtest the strategy, score risk, gate execution, and keep the whole run replayable.
>
> 中文版: [README.md](README.md)

TradeTrace turns every AI trading-agent run into a replayable, auditable trail:

```text
NL strategy → Qwen parse → Bitget Skill Evidence Pack → GetAgent backtest
            → Risk Ledger → Approval Gate → Paper / Replay execution → Post-run Report
```

AI trading agents are powerful but unsafe as black boxes — you can't see *why* a decision was made, and tool calls, backtests, risk checks, approvals, and execution are scattered everywhere, with no way to replay a failed run. TradeTrace is the missing governance layer between autonomous agents and trading execution: **a black box + cockpit voice recorder for trading-agent runs.**

Core stance: **risk scoring is rule-based, deterministic, and explainable; LLMs are used for parsing and reporting only — never for the final safety decision.**

The project originated from the [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) Track 2 (Infra), but is designed to keep growing as general infrastructure past the event.

---

## Table of contents

- [Installation](#installation)
- [Channels](#channels)
- [Usage examples](#usage-examples)
- [Run logs & reproduction](#run-logs--reproduction)
- [How a run flows](#how-a-run-flows)
- [API reference](#api-reference)
- [Project layout](#project-layout)
- [Safety notes](#safety-notes)

---

## Installation

### Prerequisites

- **Node.js ≥ 18.17** (Next.js requirement; 20 LTS recommended)
- **npm** (bundled with Node)
- Outbound internet: calls Qwen and Bitget endpoints

### 1. Clone and install

```bash
git clone <repo-url>
cd bitget-hackathon-infra
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill it in. **Only `QWEN_API_KEY` and `BITGET_API_KEY` are required** — without them you cannot create new runs (the Web UI still lets you browse the bundled samples).

| Variable | Required | Notes |
|---|---|---|
| `QWEN_API_KEY` | **yes** | Qwen API key — strategy parsing + post-run report. |
| `QWEN_BASE_URL` | prefilled | Qwen endpoint base URL. |
| `QWEN_MODEL` | prefilled | Model name to use. |
| `BITGET_API_KEY` | **yes** | Bitget GetAgent / Playbook access key, sent as the `ACCESS-KEY` header for backtests. |
| `BITGET_SECRET_KEY` | optional | Reserved for signed endpoints; **not read by current code** — kept for a future signer. |
| `BITGET_PASSPHRASE` | optional | Same as above — reserved. |
| `TELEGRAM_BOT_TOKEN` | optional | Leave empty to run the Web UI only; set to enable the Telegram bot. |
| `NEXT_PUBLIC_APP_URL` | optional | Used to build run links returned by the Telegram API. Defaults to `http://localhost:3000`. |

> Note: local and online use the **exact same code path**. If the backtest endpoint fails, the system records `getagent.backtest.failed`, falls back to a degraded estimate, and still produces a risk ledger and report — it never crashes mid-run.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (redirects to `/en` or `/zh`).

### Optional: check / build

```bash
npm run typecheck   # TypeScript type check
npm run build       # production build
npm run start       # start in production mode
```

---

## Channels

The system has two entry points that **share the same Run store** — a run started in Telegram is visible and approvable in the Web UI, and vice versa.

### A. Web UI (primary surface)

- Routes: `/zh/...` (Chinese, default), `/en/...` (English). Root `/` 307-redirects to `/zh`; toggle `中 / EN` in the top-right.
- Pages:
  - `/zh` — landing
  - `/zh/runs/new` — new run (paste an NL strategy)
  - `/zh/runs/<runId>` — run detail: Flight Recorder timeline, Risk Ledger, approval buttons, post-run report
  - `/zh/dashboard` — dashboard
- When a run enters `awaiting_approval`, the detail page shows **Approve / Reject** buttons (human-in-the-loop).

### B. Telegram bot (complementary channel)

**You don't need a real Telegram connection locally** — you can simulate the webhook (see [Usage examples](#usage-examples)). To connect for real:

1. Create a bot via [@BotFather](https://t.me/BotFather), copy `TELEGRAM_BOT_TOKEN` into `.env`.
2. Deploy to a public host (e.g. Vercel) and set `NEXT_PUBLIC_APP_URL` to your domain.
3. Register the webhook:

   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-domain/api/telegram"
   ```

4. Use the commands in Telegram:

   ```text
   /run <NL strategy>           # start a run
   /status <run_id>             # query status
   /approve <run_id>            # approve execution
   /reject <run_id> <reason>    # reject execution
   /report <run_id>             # fetch report digest
   ```

> Note: run links returned by Telegram look like `https://domain/runs/<runId>` (no locale prefix, for stable bot/curl access). Prepend `/zh` or `/en` in the browser to view the localized page.

---

## Usage examples

> The `curl` commands assume `npm run dev` is running on `localhost:3000` and `QWEN_API_KEY` + `BITGET_API_KEY` are set. API routes carry **no locale prefix**.

### Example 1: start a run (good strategy)

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"strategy":"When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long. Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive losses."}'
```

Expect a `RunBundle` where `run.status` is `completed`/`awaiting_approval`/`blocked`, `risk.level` is `Low`, `final_decision` is `Go`. A run log folder is also written under `logs/<runId>/<timestamp>/` (see below).

### Example 2: fetch run detail

```bash
curl http://localhost:3000/api/runs/<runId>
```

Returns the full bundle (timeline events, risk ledger, backtest, report).

### Example 3: approve / reject (human-in-the-loop)

```bash
# Approve (only effective when status is awaiting_approval)
curl -X POST http://localhost:3000/api/runs/<runId>/approve \
  -H 'content-type: application/json' -d '{"reason":"checked risk ledger"}'

# Reject
curl -X POST http://localhost:3000/api/runs/<runId>/reject \
  -H 'content-type: application/json' -d '{"reason":"drawdown too high"}'
```

### Example 4: dangerous strategy (blocked)

```bash
curl -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"strategy":"Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible."}'
```

Expect: `risk.level = High`, `recommendation = Block`, `run.status = blocked`, `final_decision = Block`.

### Example 5: simulate the Telegram webhook locally

```bash
curl -X POST http://localhost:3000/api/telegram \
  -H 'content-type: application/json' \
  -d '{"message":{"chat":{"id":1},"text":"/run When BTC 1h EMA20 crosses above EMA50, go long, 1.5% stop loss, max position 15%."}}'
```

Returns a `sendMessage`-shaped JSON containing the created `run_id` and link.

---

## Run logs & reproduction

### Run logs (with timestamps and call volume)

**Every run produces a structured log on disk**, grouped by run and timestamp:

```text
logs/
  run_001_a1b2c3/                 # grouped by runId (multiple lifecycles of one run cluster here)
    20260618-080322/              # timestamp of this lifecycle (UTC)
      run.log                     # NDJSON, one structured line per log entry
      summary.json                # this call's metadata + per-scope call counts (call volume)
```

- **`run.log`**: one JSON object per line with `ts` (ISO timestamp), `level`, `scope`, `message`, plus provider call-volume fields such as `status` / `attempt` / `duration` / `baseUrl` / `model`. All sensitive fields (keys, tokens, Bearer) are redacted before writing.
- **`summary.json`**: aggregates this run's `call_counts_by_scope` (call counts per scope) and `total_log_calls`, so you can see at a glance how many times Qwen / GetAgent were called.

> These logs are **generated automatically by the code at runtime** — not hand-written samples. `logs/` is in `.gitignore` and never committed: a judge running `npm run dev` and any example above will see real logs appear under `logs/`.

`run.log` single-line format (illustrative — actual content is produced by a run):

```json
{"ts":"2026-06-18T08:03:22.411Z","level":"info","scope":"qwen.strategy-parser","message":"chat completions returned","runId":"run_001_a1b2c3","baseUrl":"https://hackathon.bitgetops.com/v1","model":"qwen3.6-plus","status":200,"ok":true}
```

`summary.json` format (illustrative — actual content is produced by a run):

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

### Sample inputs + outputs (reproducible without an API)

`samples/` provides two complete "input → output" reproduction artifacts:

- **Inputs**: [`samples/strategies.md`](samples/strategies.md) — the two strategy texts (good / dangerous).
- **Outputs**: [`samples/run-success.json`](samples/run-success.json) (Low risk, `Go`, completed), [`samples/run-blocked.json`](samples/run-blocked.json) (High risk, `Block`, blocked).

Both outputs are complete `RunBundle`s (`{ run, strategy, backtest, risk, approval, report, events, evidence }`) with `backtest.provider = replay_fixture`, so they replay identically regardless of API availability. `GET /api/runs` lists these samples alongside live runs.

---

## How a run flows

```text
NL strategy -> Qwen parse -> Bitget Skill Evidence Pack -> GetAgent backtest
            -> Risk Ledger -> Approval gate
                                       |
                                       v
       Report <- Replay/execution <- paper-trading or replay run <- decision (Go / Review / Block)
```

### Evidence Pack skill priority

1. `technical-analysis` — highest value for validating whether the strategy's trigger matches the chart context.
2. `sentiment-analyst` — pre-execution risk signal for crowded or emotional trades.
3. `news-briefing` — headline / regulatory / exchange shocks before approval.
4. `market-intel` — liquidity / volatility / context signals.
5. `macro-analyst` — lower-frequency veto layer for CPI / FOMC / rates risk.

The public docs do not expose fixed REST endpoints for these five Skill Hub skills, so the Evidence Pack uses Qwen with the five documented Bitget personas to keep local and deployed behavior identical. If Bitget later exposes official callable skill endpoints, the swap point is [agent/tools/bitget-skill-evidence.ts](agent/tools/bitget-skill-evidence.ts).

---

## API reference

API routes carry no locale prefix (stable paths for Telegram webhooks, curl, and browser fetch):

```text
GET  /api/runs                  # list all runs (including samples)
POST /api/runs                  # start a run   body: {"strategy": "...", "market"?: "..."}
POST /api/runs/stream           # streamed start (NDJSON progress stream)
GET  /api/runs/:runId           # run detail
POST /api/runs/:runId/approve   # approve       body: {"reason": "..."}
POST /api/runs/:runId/reject    # reject        body: {"reason": "..."}
POST /api/runs/:runId/report    # generate / refresh report
POST /api/telegram              # Telegram webhook entry
```

---

## Project layout

```text
.
├── README.md / README.en.md
├── .env.example                # env template (annotates variables actually read by code)
├── i18n/ + messages/           # next-intl Chinese/English
├── proxy.ts                    # next-intl route proxy
├── agent/
│   ├── agent.ts                # main run lifecycle (startRun / approve / reject / execute)
│   ├── instructions.md         # agent identity & safety boundaries
│   ├── tools/                  # Qwen parse, GetAgent backtest, Risk, Trace, Evidence, Report, Approval
│   ├── skills/                 # risk ledger rules, report format
│   ├── subagents/              # trace analyst, risk officer, incident writer
│   ├── channels/               # web + telegram entry points
│   └── schedules/              # paper-trading monitor
├── app/
│   ├── [locale]/               # localized pages (/zh/..., /en/...)
│   └── api/                    # routes without locale prefix
├── lib/                        # types, env, store, redaction, logger (with on-disk logging)
├── samples/                    # replay fixtures + input strategy notes (strategies.md)
├── data/                       # local run / event store (JSON, gitignored)
└── logs/                       # per-run API call logs generated at runtime (gitignored)
```

---

## Safety notes

- The MVP **does not** execute real-money trades (the execution layer is a replay adapter that explicitly sends no real order).
- No sample run, log, or Web UI ever stores or displays secrets: logs pass through `redactObject`, and `.env` is in `.gitignore`.
- Risk scoring is **rule-based and explainable**; LLMs handle parsing and reporting only, not the final safety decision.
- Without `QWEN_API_KEY` / `BITGET_API_KEY`, new runs cannot be created; the app serves replay / sample data only.

## License

Open source — see [LICENSE](LICENSE).
