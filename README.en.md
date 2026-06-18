# TradeTrace — Flight Recorder for AI Trading Agents

> An open-source AI trading infrastructure: record *why* an agent acted, test the strategy, score risk, gate execution, and make the whole run replayable.
>
> 中文版：[README.md](README.md)

TradeTrace turns every AI trading-agent run into a replayable, auditable trail:

```text
NL strategy → Qwen parse → Bitget Skill Evidence Pack → Playbook backtest
            → Risk Ledger → Approval Gate → Paper / Replay execution → Post-run Report
```

The project is built as a **general AI trading infrastructure** that anyone can extend.
The [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon) provided the initial
problem framing (Track 2 — Infra) and a concrete set of building blocks to integrate
against (Bitget Playbook, Bitget Agent Hub skills, Qwen). The hackathon is the spark,
not the goal: the system is designed to keep evolving past it.

## Why this exists

AI trading agents are powerful but unsafe to trust as black boxes. Today:

- Users cannot easily inspect **why** an agent made a decision.
- Tool calls, backtest outputs, risk checks, approvals, and execution events are
  scattered across logs, dashboards, and chat threads.
- There is no standard **run-level audit trail**.
- Risk gates are often implicit or missing.
- Failed or dangerous runs cannot be replayed clearly for post-mortems.

TradeTrace is the missing governance layer between autonomous agents and trading
execution. It is a black box + cockpit voice recorder for trading-agent runs.

## What you get

- A **Web UI** for creating runs, viewing the Flight Recorder timeline, reading the
  Risk Ledger, performing the approval gate, and reviewing the post-run report.
- A **Telegram bot** as a complementary channel: submit strategies, approve or
  reject runs, and receive report digests from chat.
- A **provider-backed core** that uses the same code path locally and online
  (Qwen for parsing/reporting, Bitget Playbook for backtesting).
- **Sample replay runs** so the demo is stable even when external APIs are flaky.
- **Deterministic, explainable risk scoring** — LLMs are used for parsing and
  reporting, never for the final safety decision.

## Channels

| Channel | Role | Primary use |
|---|---|---|
| **Web UI** | Main demo + visualization surface | Run input, Flight Recorder timeline, Risk Ledger, Approval gate, Post-run report, Dashboard |
| **Telegram bot** | Trigger + approval channel | Submit strategies from chat, approve/reject runs, receive report digests |

The Web UI is the **primary surface**. The Telegram bot is a **complementary
channel** that proves multi-channel, human-in-the-loop governance.

## Why we use the Eve framework

TradeTrace is intentionally built on top of the [Eve](https://eve.dev) agent
framework, not a bespoke orchestration layer. Reasons:

1. **Eve's primitives map 1:1 to the product model.** Eve's `tools/`, `skills/`,
   `subagents/`, `channels/`, and `schedules/` correspond directly to the modules
   TradeTrace needs (Qwen parser, Playbook adapter, Risk Engine, Trace Store,
   Replay; Risk Ledger rules, Report format; Trace Analyst, Risk Officer,
   Incident Writer; Web and Telegram channels; paper-trading monitor). This
   keeps the project aligned with a known mental model instead of inventing its
   own.
2. **Built-in observability.** Eve exposes tool-call and workflow-turn telemetry
   that is exactly what a flight recorder needs: who did what, with what input,
   producing what output, in how long.
3. **Multi-channel by design.** Eve's `channels/` abstraction is the natural
   home for both the Web entry point and the Telegram bot. They share the same
   `Run` and `Event` store, which is the core invariant of TradeTrace — a run
   started in Telegram must be visible (and approvable) in the Web UI, and
   vice versa.
4. **Schedules for paper-trading monitors.** Eve's `schedules/` is the cleanest
   place for a future periodic paper-trading status check or daily run digest.
5. **Workflow stability over framework lock-in.** Where a beta feature is
   unstable, the corresponding responsibility lives in a plain TypeScript module
   so the product still works. Eve is used for what is stable: tools, workflow,
   channels, observability.

Eve is treated as the orchestration backbone, not a marketing sticker — see
[PLAN.md §3 Eve Mapping](PLAN.md) for the concrete file-level mapping.

## Hackathon context (and what comes after)

The project's first concrete shaping came from the Bitget AI Hackathon
(<https://bitget-ai.gitbook.io/hackathon>), Track 2 (Infra). The hackathon gave
us:

- A clear problem framing: agent trading infrastructure, not another chatbot.
- Real APIs to integrate against (Bitget Playbook for backtesting, Bitget Agent
  Hub skill personas for evidence, Qwen for parsing/reporting).
- A forcing function to ship a working MVP in a short window.

But the project is **not** a prize-targeted demo. The hackathon is the spark,
not the goal:

- The risk model, event model, and approval gate are designed to be useful well
  past submission day.
- The Web UI and Telegram bot are real product surfaces, not screens staged
  for judges.
- The `samples/` fixtures make the system demonstrable without live API access
  — a property that outlives any single demo slot.
- The Eve-based architecture is intentionally extensible: paper-trading live
  mode, OpenTelemetry-style trace IDs, webhook alerts, and multi-agent CI/CD
  are planned follow-ups, not "if we had more time" ideas.

If you are reading this after the hackathon: the same Quick Start works, the
same samples replay, the same Risk Ledger rules apply.

## Quick Start

```bash
cp .env.example .env
# Fill in QWEN_API_KEY and PLAYBOOK_ACCESS_KEY (and optionally Telegram).
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The app uses the same provider-backed path locally and online. Without
`QWEN_API_KEY` and `PLAYBOOK_ACCESS_KEY`, the "New Run" path will fall back to
replay / sample data only — useful for UI exploration but not for generating
new evidence.

## How a run flows

```text
NL strategy -> Qwen parse -> Bitget Skill Evidence Pack -> Playbook backtest
            -> Risk Ledger -> Approval gate
                                       |
                                       v
       Report <- Replay/execution <- paper-trading or replay run <- decision
```

### Evidence Pack skill priority

1. `technical-analysis` — highest value for validating whether the strategy's
   trigger matches the chart context.
2. `sentiment-analyst` — useful pre-execution risk signal for crowded or
   emotionally-driven trades.
3. `news-briefing` — catches headline/regulatory/exchange shocks before
   approval.
4. `market-intel` — adds liquidity/volatility/context signals to the audit
   trail.
5. `macro-analyst` — lower-frequency veto layer for CPI/FOMC/rates risk.

The public docs do not expose fixed REST endpoints for these five Skill Hub
skills. The Evidence Pack uses Qwen with the five documented Bitget skill
personas so local and deployed behavior stays identical. If Bitget later
exposes official callable skill endpoints or an MCP client binding, the
adapter in `agent/tools/bitget-skill-evidence.ts` is the swap point.

## Demo flows

### Good strategy

```text
When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long.
Use 1.5% stop loss, 4% take profit, max position 15%, pause after two
consecutive losses.
```

Expected path: parse → backtest → low risk → replay → report.

### Dangerous strategy

```text
Whenever price drops, keep adding to the position until it rebounds.
Use high leverage and recover losses as fast as possible.
```

Expected path: parse → backtest → high risk → blocked → incident report.

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

## Project layout

```text
.
├── README.md / README.zh.md
├── PRD.md    / PRD.zh.md
├── PLAN.md   / PLAN.zh.md
├── agent/
│   ├── instructions.md        # agent identity & safety boundaries
│   ├── agent.ts               # main run lifecycle
│   ├── tools/                 # Qwen parser, Playbook, Risk, Trace, Replay, Evidence
│   ├── skills/                # risk ledger rules, report format
│   ├── subagents/             # trace analyst, risk officer, incident writer
│   ├── channels/              # web + telegram entry points
│   └── schedules/             # P1 paper-trading monitor
├── app/                       # Next.js Web UI
├── lib/                       # shared types, risk rules, redaction
├── samples/                   # replay fixtures (run-success, run-blocked)
└── data/                      # local run/event store
```

## Safety notes

- MVP does **not** execute real-money trades.
- Secrets are **never** stored in sample runs, logs, or the Web UI.
- Provider calls are required for creating new runs in both local and deployed
  environments. Without keys, the app serves replay/sample data only.
- Risk scoring is **rule-based and explainable**. LLMs are used for parsing
  and reporting, not for final safety decisions.

## License

Open source — see [LICENSE](LICENSE).
