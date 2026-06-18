# TradeTrace Flight Recorder — Product Requirements Document

> Project: TradeTrace AI trading infrastructure
> Origin: inspired by the [Bitget AI Hackathon](https://bitget-ai.gitbook.io/hackathon)
> Track 2 (Infra). Designed to keep growing past the hackathon.
> Chinese version: [PRD.md](PRD.md)

## 1. Background

Bitget AI Hackathon Track 2 focuses on trading infrastructure: tools that improve agent efficiency, trader efficiency, safety, evaluation, monitoring, and repeatability. The judging preference is clear: working systems with depth, completion, novelty, and verifiable usage records beat concept-only demos.

TradeTrace Flight Recorder targets the missing infra layer for AI trading agents: **observability, auditability, approval, replay, and post-run analysis**.

The hackathon is the spark, not the goal. The system is designed to keep
evolving past submission day — same Quick Start, same samples, same risk
rules apply after the hackathon ends.

Instead of building another trading chatbot or strategy generator, TradeTrace records the full lifecycle of a trading-agent run and makes it replayable.

**Why Eve (and not a custom orchestrator):** see [README.md](README.md). Eve's
`tools/`, `skills/`, `subagents/`, `channels/`, `schedules/` map 1:1 to this
project's modules; its observability is exactly what a flight recorder needs;
its multi-channel abstraction is the natural home for Web + Telegram sharing
the same `Run` / `Event` store.

## 2. Product Definition

**Name:** TradeTrace Flight Recorder

**One-liner:** A flight recorder for AI trading agents: records why an agent acted, tests the strategy, scores risk, gates execution, and makes the whole run replayable.

**Primary surface:** Web UI

**Secondary surface:** Telegram bot

**Core stack:**
- Vercel Eve for agent workflow, tools, channels, approval, state, and observability.
- Qwen for strategy parsing and post-run report generation.
- Bitget Playbook for strategy backtesting and metrics.
- Optional Bitget Agent Hub / trading APIs for future paper-trading and execution adapters.

## 3. Problem

AI trading agents are powerful but unsafe to trust as black boxes.

Current pain points:
- Users cannot inspect why an agent made a decision.
- Tool calls, backtest outputs, risk checks, approvals, and execution events are scattered.
- There is no standard run-level audit trail.
- Risk gates are often implicit or missing.
- Failed or dangerous runs cannot be replayed clearly.
- Hackathon judges cannot easily verify whether a trading-agent project truly worked.

## 4. Goals

TradeTrace should:
- Create a structured run record for every trading-agent workflow.
- Capture Qwen parsing, Playbook backtest, risk scoring, approval, execution/replay, and report events.
- Make every run replayable through a visual timeline.
- Provide deterministic risk scoring with explainable rules.
- Support human approval before risky execution.
- Generate a post-run report with evidence from the run.
- Provide public sample runs for judging and reproducibility.

## 5. Non-goals

TradeTrace will not:
- Execute real-money trades in the MVP.
- Promise trading returns.
- Build a full trading terminal.
- Build a full quantitative backtest engine from scratch.
- Support every strategy type or every exchange.
- Build monetization, subscription, or multi-tenant admin features.

## 6. Users

### AI Trading Agent Builder
Needs to debug and govern agent behavior.

Jobs:
- Understand why a run succeeded or failed.
- See tool calls and risk checks.
- Export reproducible run evidence.

### Cautious Trader / Researcher
Wants AI help but does not trust a black-box system.

Jobs:
- Inspect strategy logic.
- Review backtest evidence.
- Approve or reject risky runs.

### Hackathon / External Reviewer
Needs to evaluate whether the project is real infra.

Jobs:
- Run or replay a complete example.
- Verify API-backed evidence.
- Understand why this is not just a chatbot.

### Post-hackathon user (long tail)
The same project is meant to be used and extended long after the hackathon
window closes. The Quick Start, sample runs, and risk rules should still
work without modification.

## 7. Final Product Form

TradeTrace ships as **Web UI + Telegram bot**.

### Web UI
The Web UI is the primary demo and evaluation surface.

It includes:
- New Run page.
- Flight Recorder run detail page.
- Risk Ledger panel.
- Approval Gate panel.
- Replay mode.
- Post-run report page.
- Lightweight dashboard.

### Telegram Bot
The Telegram bot is the secondary channel.

It supports:
- Submit a strategy from chat.
- Receive parse/backtest/risk status updates.
- Approve or reject a pending run.
- Receive a final report digest with a Web UI link.

### Channel rule
Both channels operate on the same `Run` object and event store. A run created from Telegram must be visible in the Web UI. A run created in the Web UI may send approval/report notifications to Telegram.

## 8. Core User Journeys

### Journey A: Web UI happy path
1. User opens New Run.
2. User enters a natural-language strategy.
3. Qwen parses it into `StrategySpec`.
4. Playbook runs backtest.
5. Risk Engine returns `Go` or `Review`.
6. User approves if needed.
7. Run enters replay/paper execution.
8. User views the timeline and report.

### Journey B: Telegram approval path
1. User sends `/run <strategy>` in Telegram.
2. Bot replies with parsed summary.
3. Bot posts backtest and risk result.
4. If approval is needed, bot shows Approve / Reject actions.
5. User approves.
6. Bot sends final report digest and Web UI link.

### Journey C: High-risk blocked path
1. User enters a dangerous strategy, e.g. martingale / high leverage / unlimited averaging down.
2. Qwen parser extracts risk-relevant intent.
3. Risk Engine marks it High.
4. Approval Gate blocks the run.
5. Incident report explains why it was blocked.
6. Timeline can replay the full blocked run.

## 9. Functional Requirements

### F1. Run Creation
- Generate unique `run_id`.
- Persist initial input and source channel.
- Track status transitions.

Statuses:
- `created`
- `parsing`
- `backtesting`
- `risk_review`
- `awaiting_approval`
- `executing`
- `completed`
- `blocked`
- `failed`

### F2. Strategy Parser
- Input: natural-language strategy.
- Output: structured `StrategySpec`.
- Required fields:
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
- Failure mode: return missing fields and suggested clarifying questions.

### F3. Playbook Backtest Adapter
- Convert `StrategySpec` to Playbook request format.
- Run backtest or retrieve backtest result.
- Extract:
  - `pnl`
  - `sharpe`
  - `max_drawdown`
  - `win_rate`
  - `trade_count`
  - `backtest_period`
- Store raw result reference without exposing secrets.

### F4. Risk Ledger
- Deterministic rule-based scoring first.
- LLM explanations may be used only for summarization.
- Output:
  - `score`
  - `level`: Low / Medium / High
  - `recommendation`: Go / Review / Block
  - `triggered_rules`
  - `reasons`

Example risk rules:
- High leverage or unlimited averaging down -> High / Block.
- Missing stop loss -> Medium or High depending on strategy.
- Max drawdown above threshold -> Review or Block.
- Very low trade count -> Review.
- Ambiguous entry/exit conditions -> Review.

### F5. Approval Gate
- Low risk: may auto-continue.
- Medium risk: requires approval.
- High risk: blocked by default.
- Approval record must include decision, reason, timestamp, and channel.

### F6. Flight Timeline
- All major workflow steps emit events.
- Events show actor, status, timestamp, duration, input summary, and output summary.
- UI supports expanding events.

Required event types:
- `strategy.input.received`
- `strategy.parsed`
- `playbook.backtest.started`
- `playbook.backtest.completed`
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

### F7. Replay Mode
- Replay saved historical events.
- Use real previously generated run records.
- Support stable demo without live API dependency.
- Clearly label replay data as historical run data.

### F8. Post-run Report
- Generate a human-readable report from run evidence.
- Include:
  - Executive summary.
  - Strategy intent.
  - Backtest evidence.
  - Risk findings.
  - Approval decision.
  - Execution/replay result.
  - Suggested next steps.

### F9. Telegram Bot
- Commands:
  - `/start`
  - `/run <strategy>`
  - `/status <run_id>`
  - `/approve <run_id>`
  - `/reject <run_id> <reason>`
  - `/report <run_id>`
- Bot messages must link to the Web UI run detail page.
- Approval actions must be recorded in the same `ApprovalRecord` object as Web approvals.

### F10. Dashboard
- Show recent runs.
- Show risk distribution.
- Show blocked/review/go counts.
- Show average run duration.
- Show failed runs.

## 10. Data Objects

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
  "provider": "bitget_playbook",
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
  "actor": "user|agent|qwen|playbook|risk_engine|approval|execution",
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

## 11. Success Metrics

Product success:
- Full-run completion rate.
- Event completeness rate.
- Percentage of runs with risk explanation.
- Percentage of runs with replayable timeline.
- Number of blocked high-risk demo cases.

Hackathon success:
- At least 2 replayable sample runs.
- At least 1 real Playbook-backed backtest record.
- At least 1 blocked high-risk strategy.
- README enables another developer/judge to run or replay the system.
- 3-minute video shows the full loop.

## 12. Acceptance Criteria

MVP is accepted when:
- A user can start a run from Web UI.
- A user can start or approve a run from Telegram.
- A run records parse, backtest, risk, approval, replay/execution, and report events.
- Good strategy path reaches Go/Review.
- Dangerous strategy path reaches Block.
- Playbook result is stored and displayed.
- Risk Ledger explains triggered rules.
- Replay Mode works without live API calls.
- Post-run Report references actual run evidence.
- No API key or secret appears in logs, UI, reports, or sample data.
