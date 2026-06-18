# Sample strategies — reproducible inputs

This file lists the exact natural-language strategy inputs that produce the two
bundled sample runs. Pair each input with its output fixture to see the full
"input → output" path end-to-end, with no external API required.

| Input strategy | Output fixture | Risk | Final decision | Run status |
|---|---|---|---|---|
| [Good strategy](#good-strategy) | [`run-success.json`](run-success.json) | Low (score 0) | Go | completed |
| [Dangerous strategy](#dangerous-strategy) | [`run-blocked.json`](run-blocked.json) | High (score 100) | Block | blocked |

Both fixtures are complete `RunBundle` objects of the same shape a live run
returns: `{ run, strategy, backtest, risk, approval, report, events, evidence }`.
They use `backtest.provider = "replay_fixture"` so they replay identically
regardless of API availability.

## Good strategy

```text
When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long.
Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive
losses.
```

Expected path: **Qwen parse → evidence pack → backtest → Low risk (Go) →
replay execution → post-run report.** The run completes; `run-success.json`
holds the full timeline, risk ledger, and report.

## Dangerous strategy

```text
Whenever price drops, keep adding to the position until it rebounds. Use high
leverage and recover losses as fast as possible.
```

Expected path: **Qwen parse → evidence pack → backtest → High risk (Block) →
blocked at the approval gate → incident report.** The run never reaches
execution; `run-blocked.json` shows the critical risk rules hit (martingale,
high leverage) and the block decision.

## Reproduce live

With `QWEN_API_KEY` and `BITGET_API_KEY` set, the same inputs can be submitted
through the Web UI (`/zh/runs/new`) or the API to generate a fresh live run —
which will additionally write a per-run log folder under `logs/` (see the
"Run logs" section of the README).
