# Test strategies

A set of natural-language strategies for exercising the full TradeTrace pipeline
(Qwen parse → evidence pack → local backtest → risk scoring → approval →
execution).

Each one is tagged with its **expected risk outcome** so you can target the
branch you want to test:

- 🟢 **Go (Low)** — likely passes straight to execution
- 🟡 **Review (Medium)** — lands in `awaiting_approval`; the Web detail page /
  Telegram message shows Approve / Reject buttons
- 🔴 **Block (High)** — the risk engine hits a critical rule and stops the run

The strategies are written in **conversational, natural language** (not the
stiff `When X, go long. Use Y.` template style) to stress the Qwen parser
against how real users actually describe a strategy.

> There is also [`strategies.md`](strategies.md) — that file binds two JSON
> fixtures and exists for **reproducibility**. This file is a **test-coverage**
> list; the two serve different purposes.

---

## 🟢 Expected Low risk (Go)

### 1. SOL mean reversion

```text
I've noticed SOL on the 15-minute chart often drifts away from the vwap and then reverts, so I want to trade that reversion: when price drops more than 2 standard deviations below the vwap I go long, and I close when it comes back to the vwap. I only use 5% position per trade, keep the stop loss at 1%, hold one position at a time, and don't get greedy.
```

### 2. BTC trend follow

```text
I want to trade BTC with the big trend: as long as the 50-period EMA is above the 200-period EMA, RSI isn't overbought (between 40 and 60), and the MACD histogram just flipped positive, I'll size in lightly long, stop loss 2%, take profit 5%, no more than 8% per position, and at most 4 trades a day.
```

---

## 🟡 Expected Medium risk (Review — approval buttons appear)

### 3. ETH range grid

```text
I think ETH is going to oscillate between 3000 and 3500 for a while, so I want to run a grid inside that range: place a buy order every 2% going down and a sell order every 2% going up, using a small 3x position per level, and cap the whole grid's total exposure at 20%.
```

> Grid strategies tend to have many `unknowns` and parse ambiguously → the risk
> engine often returns Review.

### 4. BTC oversold bounce (with leverage)

```text
When BTC on the 1-hour chart has RSI dropping below 25 I read it as oversold, so I want to catch the bounce with 2x leverage and exit once RSI gets back above 55, targeting about 6% profit, position around 12%.
```

> 2x leverage plus a larger position size → usually Review.

### 5. Altcoin momentum rotation

```text
I want to trade whichever altcoin had the strongest move over the last 24 hours — pick the strongest among SOL, AVAX, LINK and DOT, buy it, hold for 4 hours, then rotate into the next strongest, no more than 10% position per coin, 3% stop loss.
```

---

## 🔴 Expected High risk (Block — risk engine halts the run)

### 6. Doubling down (martingale + high leverage)

```text
I want to double the position size after every losing trade until I make it back, use 10x leverage on BTC, no stop loss, and trade around the clock nonstop.
```

### 7. Chase the pump, all-in

```text
Whenever ETH goes up 5% in one hour I want to go all in, use 20x leverage to maximize the return, no stop loss, just hold and wait to double my money.
```

### 8. Buy every dip (averaging down)

```text
As long as SOL is dropping I just keep adding to lower my average cost, adding 50% more position for every 5% it falls, and use the highest leverage available.
```

---

## ⚙️ Edge-case / special coverage

### 9. Short trend

```text
I want to short BTC when it's weak: on the 1-hour chart, when EMA12 crosses below EMA26 and ADX is above 25 (so the trend is strong enough), I enter a short, stop loss 2%, take profit 4%, position 10%.
```

### 10. Minimal / fuzzy (stress the parser)

```text
Just buy low and sell high on ETH, figure it out.
```

### 11. Long-term hold

```text
I plan to hold BTC long term: as long as the weekly close is above the 50-week EMA I get in and hold for at least 30 days unless it drops past a 15% stop loss. I can put 25% of the book on this one.
```

### 12. Both directions

```text
I trade ETH both ways: on the 4-hour chart I go long when EMA20 crosses above EMA50 and short when it crosses below, stop loss 2% per trade and I only risk 1.5% per trade.
```

---

## Test matrix

| Branch to verify | Use |
|---|---|
| Healthy path (Go) | #1, #2 |
| Approval buttons appear (Review) | #3, #4, #5 |
| Risk engine halts (Block) | #6, #7, #8 |
| Short direction parsing (direction: short) | #9 |
| Parser robustness on fuzzy input | #10 |
| Different symbol / timeframe coverage | #1 (SOL 15m), #11 (BTC weekly), #12 (ETH both) |

## How to run

Use any strategy above as the strategy input:

- **Web UI**: open `/runs/new`, paste into the textarea, click Create run.
- **Telegram**: `/run <paste the strategy text above>`.
- **curl**:

```bash
curl -X POST http://localhost:3000/api/runs/stream \
  -H 'content-type: application/json' \
  -d '{"strategy":"I'"'"'ve noticed SOL on the 15-minute chart often drifts away from the vwap … (paste the text)"}' \
  -m 120
```

> Requires `QWEN_API_KEY`; backtesting uses Bitget's public klines — **no Bitget
> key needed**.
