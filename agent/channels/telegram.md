# Telegram Channel

TradeTrace exposes Telegram as a secondary channel for triggering, monitoring, and approving runs.

## Webhook

```text
POST /api/telegram
```

The webhook calls the Telegram Bot API directly (`api.telegram.org`). Set `TELEGRAM_BOT_TOKEN` in `.env` to enable delivery; when unset, the route still responds 200 and degrades to no-ops (Web-only mode).

Register the webhook once (see README):

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-domain/api/telegram"
```

Register the command menu (so commands appear in the autocomplete; safe to re-run):

```bash
npm run telegram:register
```

## Commands

```text
/start, /help          — list commands
/run <strategy>        — create a run; streams stage progress in one message,
                         ends with inline Approve/Reject buttons when approval is needed
/status <run_id>       — current status and final decision
/report <run_id>       — executive summary + link
```

## Live progress and approval buttons

`/run` creates the run via `agent.startRun` with `source: 'telegram'` and an `onProgress` sink. The sink:

1. Posts **one** message with the run id and current status.
2. **Edits the same message** on key stage transitions (strategy parsed, evidence collected, backtest result, risk scored) — filtered so the chat isn't spammed.
3. When the run reaches `awaiting_approval`, attaches an inline keyboard with **Approve / Reject** buttons (callback_data `approve:<run_id>` / `reject:<run_id>`).

Tapping a button fires a `callback_query`; the webhook calls `approveRun` / `rejectRun` with `source: 'telegram'` and the reviewer reference `telegram:<chat_id>:<user_id>`, then edits the message to show the outcome.

The bot shares the same run/event store as the Web UI, so a Telegram-created run is inspectable at `/runs/<run_id>`. Because `startRun` / `approveRun` are channel-agnostic, the agent code is unchanged between the Web and Telegram paths.
