# Sample strategies — reproducible inputs

This file lists the exact natural-language strategy inputs that produce the two
bundled sample runs. Pair each input with its output fixture to see the full
"input → output" path end-to-end.

Both fixtures were captured from **real local-deterministic backtests** over
Bitget public klines (BTCUSDT, 1h, 2026-05-09 → 2026-06-20). They are stored as
`backtest.provider = "replay_fixture"` so they replay identically with no API
key required — but the metrics (PnL, Sharpe, drawdown, trade count) are **not
fabricated**; each fixture records its provenance in `backtest.notes`.

| Input strategy | Output fixture | Backtest (real) | Risk | Final decision | Run status |
|---|---|---|---|---|---|
| [Trend-following short](#trend-following-short-good) | [`run-success.json`](run-success.json) | +8.3% PnL, Sharpe 2.95, 22 trades | Medium (Review) | Go | completed |
| [Martingale + high leverage](#martingale--high-leverage-dangerous) | [`run-blocked.json`](run-blocked.json) | -1.99% PnL, 11 trades | High (score 100) | Block | blocked |

Both fixtures are complete `RunBundle` objects of the same shape a live run
returns: `{ run, strategy, evidence, backtest, risk, approval, report, events }`.

## Trend-following short (good)

```text
Short BTCUSDT on 1h timeframe using EMA12 crossing below EMA26 as the entry,
with a 2% stop loss and 5% take profit. Trend-following short only.
```

Expected path: **Qwen parse → evidence pack → local backtest (+8.3% PnL on real
klines) → Review risk → human approval → replay execution → post-run report.**
The run completes; `run-success.json` holds the full timeline, risk ledger,
and report. BTC trended down ~21% over the window, so the short trend-following
plan is profitable — a real result, not a canned demo number.

## Martingale + high leverage (dangerous)

```text
Whenever price drops, keep adding to the position until it rebounds. Use high
leverage and recover losses as fast as possible.
```

Expected path: **Qwen parse → evidence pack → local backtest → High risk (Block)
→ blocked at the approval gate → incident report.** The run never reaches
execution; `run-blocked.json` shows the critical risk rules hit
(`no-martingale` critical, `high-leverage`, `missing-stop-loss`) and the block
decision with a 100/100 score.

## Reproduce live

With `QWEN_API_KEY` set (no Bitget key needed — backtesting uses Bitget's public
kline endpoints), submit the same inputs through the Web UI (`/runs/new`) or the
API to generate a fresh live run, which additionally writes a per-run log folder
under `logs/`. See the README "Quick start" section.
