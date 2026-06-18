# TradeTrace Implementation Plan

> Scope: implementation plan for the TradeTrace AI trading infrastructure.
> Origin: inspired by [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon)
> Track 2 (Infra). Designed to keep growing past the hackathon.
> 中文版：[PLAN.md](PLAN.md)

## 1. Final Form

TradeTrace ships as **Web UI + Telegram bot**.

### Primary: Web UI
The Web UI is the main demo and judging surface.

It must make the idea visually obvious:
- A timeline that looks like a flight recorder.
- A Risk Ledger that explains why the run is allowed, reviewed, or blocked.
- A Post-run Report that turns raw events into an audit-ready narrative.
- A Replay Mode that can demo historical real runs even if APIs are unstable.

### Secondary: Telegram bot
The Telegram bot is a channel for real-world usage:
- Start a run from chat.
- Receive status updates.
- Approve or reject runs.
- Receive final report digest.

Telegram should not replace the Web UI. It proves multi-channel, human-in-the-loop governance through Eve's channel model.

## 2. Architecture

```text
                         +-------------------------+
                         |        Web UI            |
                         | New Run / Timeline /     |
                         | Risk Ledger / Report     |
                         +-----------+-------------+
                                     |
+--------------------+               |               +--------------------+
|    Telegram Bot    |---------------+--------------▶|   Eve Agent Runtime |
| /run /approve      |               |               | workflow + tools    |
+--------------------+               |               +---------+----------+
                                     |                         |
                                     v                         v
                         +-------------------------+   +--------------------+
                         | Run/Event Store          |   | External Adapters   |
                         | runs, events, risk,      |   | Qwen + Playbook     |
                         | approvals, reports       |   | Bitget optional     |
                         +-------------------------+   +--------------------+
```

## 3. Eve Mapping

Use Eve as the agent orchestration layer, not just a wrapper.

| Eve area | TradeTrace use |
|---|---|
| `instructions.md` | Agent identity, safety boundaries, reporting style |
| `agent.ts` | Main run lifecycle orchestration |
| `tools/` | Qwen parser, Playbook adapter, Risk Engine, Trace Store, Replay |
| `skills/` | Risk ledger rules, run summary/report format |
| `subagents/` | Trace analyst, risk officer, incident writer |
| `channels/` | Web/API entry and Telegram bot channel |
| `schedules/` | P1 paper-trading monitor / periodic run status update |
| Eve observability | Debugging and judging evidence for tool calls and workflow turns |

If Eve beta template uses a slightly different file layout, preserve the same module responsibilities.

### Why Eve (and not a custom orchestrator)

- **Eve's primitives map 1:1 to the product model** — see README for the full reasoning.
- **Built-in observability** is exactly what a flight recorder needs.
- **Multi-channel by design** — `channels/` makes the shared `Run` / `Event` store between Web and Telegram a natural outcome.
- **`schedules/` cleanly hosts** a future paper-trading monitor.
- **Eve is used for what is stable** (tools, workflow, channels, observability). When a beta feature is unstable, the responsibility lives in a plain TypeScript module.

## 4. Project Structure

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
|   |   +-- playbook-backtest.ts
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

The exact layout can adapt to Eve/Next.js initialization, but root docs and `samples/` should remain easy for reviewers to inspect.

## 5. MVP Scope

### Must-have
- Web UI New Run page.
- Web UI Run Detail page with timeline.
- Qwen strategy parser.
- Playbook backtest adapter.
- Risk Engine.
- Approval Gate.
- Replay Mode.
- Post-run Report.
- Telegram `/run`, `/status`, `/approve`, `/reject`, `/report` basics.
- 2-3 sample runs saved as JSON.

### Nice-to-have
- Dashboard stats.
- Paper-trading live status adapter.
- Decision graph visualization.
- OpenTelemetry-style trace/span IDs.
- Webhook alerts.

## 6. Implementation Order

### Phase 1: Data and run lifecycle
Create the backbone first.

Tasks:
- Define TypeScript types for Run, Event, StrategySpec, BacktestResult, RiskAssessment, ApprovalRecord, Report.
- Implement Trace Store abstraction.
- Implement run status transitions.
- Implement event append/read APIs.
- Create sample run fixtures.

Outcome:
- A run can exist without UI or external APIs.
- Replay Mode can render from stored events.

### Phase 2: External adapters
Add real evidence.

Tasks:
- Implement Qwen parser with strict JSON schema.
- Implement Playbook backtest adapter.
- Redact secrets from all logs and saved outputs.
- Store raw response references or sanitized summaries.

Outcome:
- At least one real parse + backtest result can be saved as a sample run.

### Phase 3: Risk and approval
Make it governance infra.

Tasks:
- Implement deterministic risk rules.
- Calculate risk score and recommendation.
- Implement Approval Gate state transitions.
- Add Web and Telegram approval records.

Outcome:
- Good strategy goes Go/Review.
- Dangerous strategy goes Block.

### Phase 4: Web UI
Make the demo memorable.

Tasks:
- New Run page.
- Run Detail page with timeline.
- Risk Ledger panel.
- Approval panel.
- Report panel.
- Dashboard stats if time permits.

Outcome:
- Reviewers can visually understand the Flight Recorder concept in 30 seconds.

### Phase 5: Telegram bot
Prove multi-channel governance.

Tasks:
- `/run <strategy>` starts a run.
- `/status <run_id>` returns current status.
- `/approve <run_id>` approves pending run.
- `/reject <run_id> <reason>` rejects pending run.
- `/report <run_id>` returns report summary and Web UI link.

Outcome:
- A run can be started or approved from Telegram and inspected in Web UI.

### Phase 6: Submission polish
Make it reviewer-friendly.

Tasks:
- Save sample run JSON.
- Add screenshots/GIFs.
- Record 3-minute video.
- Verify README Quick Start.
- Confirm no secrets in repository.
- Explain live mode vs replay mode clearly.

Outcome:
- Public repo is self-explanatory and verifiable.

## 7. Cadence (not bound to a 3-5 day hackathon)

The initial cadence was hackathon-driven. It is a sprint, not a terminal state.
Post-submission follow-up order:

1. Lock the backbone.
2. Connect Qwen + Playbook + Risk.
3. Build the Flight Recorder Web UI.
4. Telegram + replay + samples.
5. Submission polish.
6. After submission: paper-trading live mode, trace/span IDs, webhook alerts, multi-agent CI/CD.

## 8. Demo Script

### Demo 1: Good/review strategy
Input:

```text
When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long. Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive losses.
```

Show:
- Web UI creates run.
- Qwen parsed strategy.
- Playbook backtest metrics.
- Risk Ledger recommends Go or Review.
- Approve if needed.
- Replay/execution event appears.
- Post-run Report summarizes the decision chain.

### Demo 2: Dangerous blocked strategy
Input:

```text
Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible.
```

Show:
- Qwen identifies martingale-like behavior.
- Risk Engine flags unlimited averaging down / high leverage.
- Run is blocked.
- Incident report explains why.
- Replay shows the blocked path.

### Demo 3: Telegram channel
Show:
- `/run <strategy>` from Telegram.
- Bot returns run id and Web UI link.
- Bot asks for approval if needed.
- `/approve <run_id>` updates the same Web UI run.

## 9. Risk Rules MVP

Start with transparent deterministic rules.

Example scoring:

| Rule | Severity | Recommendation impact |
|---|---|---|
| Mentions high leverage | High | Review/Block |
| Unlimited averaging down / martingale | Critical | Block |
| Missing stop loss | Medium | Review |
| Position limit > 30% | Medium | Review |
| Max drawdown > 20% | High | Review/Block |
| Sharpe < 0.5 | Medium | Review |
| Trade count < 10 | Low/Medium | Review note |
| Ambiguous entry or exit | Medium | Review |

Risk Engine must return reasons reviewers can understand without reading code.

## 10. Security and Redaction

Never store or display:
- `QWEN_API_KEY`
- `BITGET_API_KEY`
- `BITGET_SECRET_KEY`
- `BITGET_PASSPHRASE`
- `TELEGRAM_BOT_TOKEN`

All raw external responses should be sanitized before saving to `samples/` or showing in UI.

Sample run records should include enough evidence to verify behavior, but not secrets or account-identifying details.

## 11. Fallback Strategy

### If Playbook is unstable
- Use Replay Mode with historical real run data.
- Clearly label it as replay of prior real API output.
- Keep one static sample result in `samples/`.

### If Qwen parsing is unstable
- Use strict JSON schema and template prompts.
- Provide example strategy buttons.
- Fallback to editable structured form.

### If Telegram integration takes too long
- Keep Web UI complete.
- Implement only `/run` and `/status`, then document approval as planned/P1.

### If paper trading is too much
- Use replay execution.
- Keep execution adapter interface for future live mode.

### If Eve beta blocks a feature
- Preserve the product structure with plain TypeScript modules.
- Use Eve for what is stable: tools, workflow, channels, and observability.

## 12. Acceptance Checklist

- Public GitHub repository.
- README with Quick Start.
- `PRD.md`, `PLAN.md` (Chinese is the canonical version; English in `*.en.md`).
- Sample run JSON files.
- At least one real Playbook-backed result.
- Screenshots:
  - New Run
  - Timeline
  - Risk Ledger
  - Approval Gate
  - Post-run Report
  - Telegram bot message
- 3-minute demo video.
- Clear limitation statement: paper/replay only, no real-money execution.
- No secrets committed.

## 13. Pitch

```text
TradeTrace is the flight recorder for AI trading agents.
It records every strategy run as a replayable audit trail:
what the user asked, how the model parsed it, how Playbook tested it,
what risks were triggered, who approved it, and what happened next.

We are not making another trading chatbot.
We are building the missing governance layer between autonomous agents and trading execution.
```
