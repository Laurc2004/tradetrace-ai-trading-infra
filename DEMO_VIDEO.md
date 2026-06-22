# TradeTrace — 3-Minute Demo Video Script

> Format: **screencast + subtitles + AI voiceover (no live narration)**.
> Hard limit: **3:00**. Voiceover language: English (recommended for international
> judges). Provide Chinese subtitles as a separate `.srt` if useful.

This file is a shot-by-shot shooting script. Each row = one shot. Record the
screen for the "Action" column, drop the "Voiceover" lines into a TTS tool, and
burn the "Subtitle" lines onto the video.

Time budget per section (must sum to ≤ 3:00):

| Section | Duration | Cumulative |
|---|---|---|
| ① Hook + positioning | 0:25 | 0:25 |
| ② Healthy path (real backtest) | 1:15 | 1:40 |
| ③ Blocked path (governance) | 0:45 | 2:25 |
| ④ Low-friction integration + CTA | 0:35 | 3:00 |

---

## Pre-roll setup (do this BEFORE hitting record)

1. `npm run dev`, open `http://localhost:3000`.
2. **Pre-create both runs** so the video doesn't sit on Qwen's ~50s latency live:
   - Submit the healthy strategy → let it finish → **Approve** it.
   - Submit the dangerous strategy → it auto-Blocks.
   - Now both finished runs are in the dashboard + detail pages — no waiting on camera.
3. Browser: fullscreen, zoom 110%, hide bookmarks bar. Use a clean desktop.
4. Keep `data/runs.json` with just these 2 runs (or clear it and rely on samples).
5. Have two browser tabs ready: `/runs/new` (blank) and the two run detail pages.

---

## Shot-by-shot

### Section ① — Hook + positioning (0:00–0:25)

| # | Time | Action (screen) | Voiceover (EN, for TTS) | Subtitle (EN) |
|---|---|---|---|---|
| 1 | 0:00–0:06 | Land on `/`. Hero terminal + headline "A flight recorder for AI trading agents." Hold 2s, slow scroll to feature cards. | "AI trading agents are powerful — but as black boxes, they're dangerous. You can't see *why* a decision was made." | AI trading agents are powerful — but as black boxes, they're dangerous. |
| 2 | 0:06–0:16 | Continue scroll to the 3 feature cards (Trace / Govern / Replay). Highlight "Govern — risk before execution." | "Tool calls, backtests, risk checks, approvals — scattered everywhere, with no way to replay a failed run." | Tool calls, backtests, risk, approvals — scattered, not replayable. |
| 3 | 0:16–0:25 | Text card / overlay: **"TradeTrace = a flight recorder for AI trading agents."** then cut to `/runs/new`. | "TradeTrace is the missing governance layer: a flight recorder that makes every run observable, governable, and replayable." | TradeTrace: the missing governance layer for trading agents. |

### Section ② — Healthy path, real backtest (0:25–1:40)

| # | Time | Action (screen) | Voiceover (EN) | Subtitle (EN) |
|---|---|---|---|---|
| 4 | 0:25–0:35 | On `/runs/new`. Click the "BTC momentum + guardrails" (or short trend) template. Show the strategy text. | "Start from a natural-language strategy. Qwen parses it into structured intent." | Start from a natural-language strategy. Qwen parses it into structured intent. |
| 5 | 0:35–0:55 | **Switch to the pre-finished run detail page** (don't wait live). Show the timeline streaming events: `qwen.parse`, `evidence.collect`, `backtest` — point at each. | "The recorder captures every step: parse, evidence pack, backtest, risk, approval, and report — one ordered, replayable timeline." | Every step recorded into one replayable timeline. |
| 6 | 0:55–1:15 | Scroll to **Backtest Evidence panel**. Highlight: "Local deterministic backtest · Bitget public klines", period "2026-05-09 to 2026-06-20", "22 trades", **PnL +8.3%, Sharpe 2.95**. Expand the "provenance" details. | "Crucially, the backtest is real — it runs a deterministic simulation over Bitget's own public kline data. No fabricated metrics, no API key needed." | Real backtest on Bitget public klines. No fake metrics, no key needed. |
| 7 | 1:15–1:30 | Scroll to **Risk Ledger**. Show Low/Medium level, the triggered rules, the human-readable reasons. | "A deterministic, rule-based risk ledger explains *why* — in language a reviewer can read without touching code." | Rule-based risk ledger explains *why* — in plain language. |
| 8 | 1:30–1:40 | Scroll to **post-run report**. Show executive summary citing the real evidence. | "And a post-run report ties it all together, citing the actual run evidence." | A post-run report ties it together, citing real evidence. |

### Section ③ — Blocked path, governance (1:40–2:25)

| # | Time | Action (screen) | Voiceover (EN) | Subtitle (EN) |
|---|---|---|---|---|
| 9 | 1:40–1:50 | Open the **blocked run** detail page. Show status pill = **blocked**, decision = **Block**. | "Now the worst case: a dangerous strategy — martingale, high leverage, no stop loss." | Worst case: martingale, high leverage, no stop loss. |
| 10 | 1:50–2:10 | Scroll to Risk Ledger. Point at the critical rules: `no-martingale (critical)`, `high-leverage`, score **100/100**, recommendation **Block**. | "The risk engine scores it 100 out of 100 and blocks it *before* execution — deterministically, not by LLM guess." | Scored 100/100, blocked before execution — deterministically. |
| 11 | 2:10–2:25 | Scroll to the **timeline** showing `run.blocked`. Then to the incident report. | "The run never reaches execution. The full block path is captured and replayable — for any post-mortem." | Never reaches execution. The full block path is replayable. |

### Section ④ — Low-friction integration + CTA (2:25–3:00)

| # | Time | Action (screen) | Voiceover (EN) | Subtitle (EN) |
|---|---|---|---|---|
| 12 | 2:25–2:40 | Show terminal: `npm install && cp .env.example .env` → only `QWEN_API_KEY` highlighted. Then `npm run dev`. | "Getting started is low-friction: one dependency, one API key — Qwen. Backtesting uses Bitget's public data, so no Bitget key is required." | One key. Backtesting uses Bitget public data — no Bitget key. |
| 13 | 2:40–2:52 | Quick montage: `/api/runs` curl, Telegram `/run` command, dashboard stats. | "Integrate via Web UI, REST API, or Telegram — all sharing one run store." | Integrate via Web, API, or Telegram — one shared run store. |
| 14 | 2:52–3:00 | End card: **TradeTrace — flight recorder for AI trading agents.** + GitHub URL + "Bitget AI Hackathon · Track 2 · Trading Infra". | "TradeTrace — replayable, auditable governance for autonomous trading agents. GitHub link in the description." | TradeTrace — replayable, auditable governance. Link below. |

---

## Voiceover script (paste into TTS, English)

> AI trading agents are powerful — but as black boxes, they're dangerous. You can't see *why* a decision was made. Tool calls, backtests, risk checks, approvals — scattered everywhere, with no way to replay a failed run.
>
> TradeTrace is the missing governance layer: a flight recorder that makes every run observable, governable, and replayable.
>
> Start from a natural-language strategy. Qwen parses it into structured intent. The recorder captures every step — parse, evidence pack, backtest, risk, approval, and report — into one ordered, replayable timeline.
>
> Crucially, the backtest is real. It runs a deterministic simulation over Bitget's own public kline data. No fabricated metrics, no API key needed.
>
> A deterministic, rule-based risk ledger explains *why* — in language a reviewer can read without touching code. And a post-run report ties it all together, citing the actual run evidence.
>
> Now the worst case: a dangerous strategy — martingale, high leverage, no stop loss. The risk engine scores it one hundred out of one hundred, and blocks it *before* execution — deterministically, not by LLM guess. The run never reaches execution. The full block path is captured and replayable, for any post-mortem.
>
> Getting started is low-friction: one dependency, one API key — Qwen. Backtesting uses Bitget's public data, so no Bitget key is required. Integrate via Web UI, REST API, or Telegram — all sharing one run store.
>
> TradeTrace — replayable, auditable governance for autonomous trading agents. GitHub link in the description.

Word count: ~250 words. At a natural TTS pace (~130 wpm) that's ~1:50 of
voiceover, leaving ~1:10 of breathing room / music / pauses across 3:00. ✅

---

## Recording & production checklist

### Capture
- [ ] **OBS Studio** (free) or macOS Cmd+Shift+5 screen recording. 1920×1080, 30fps.
- [ ] Record in **segments per shot** — easier to re-do one shot than the whole thing.
- [ ] Pre-create both runs (see Pre-roll setup) so nothing waits on Qwen latency on camera.
- [ ] Slow, deliberate scrolling; pause 1–2s on each key metric so subtitles/voiceover sync.

### Voiceover (AI / TTS)
- [ ] Paste the English voiceover block above into a TTS tool (ElevenLabs / OpenAI TTS / Edge TTS).
- [ ] Pick a calm, neutral voice. Generate one continuous audio file, then align it to sections.
- [ ] Optionally generate a Chinese voiceover with a translated version for a CN-subtitled cut.

### Subtitles
- [ ] Burn the "Subtitle (EN)" lines as on-screen text at the shot's timecode (or auto-sync via Whisper from the voiceover audio).
- [ ] Keep subtitles short — one line, ≤ 8 words where possible.

### Edit
- [ ] DaVinci Resolve / CapCut / iMovie. Trim dead air aggressively — 3:00 goes fast.
- [ ] Light background music, low volume under voiceover.
- [ ] End card: project name + GitHub URL + "Bitget AI Hackathon · Track 2".

### What NOT to do
- Don't show the live 50–90s Qwen wait on camera — use pre-finished runs.
- Don't claim real-money trading — say "replay / paper" honestly.
- Don't skip the real backtest numbers (+8.3%, Sharpe 2.95, 100/100 block) — those are your verifiable-evidence money shots.
