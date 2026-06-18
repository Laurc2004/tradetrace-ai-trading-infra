# Telegram Channel

TradeTrace exposes Telegram as a secondary channel for triggering and approving runs.

Webhook endpoint:

```text
POST /api/telegram
```

Supported commands:

```text
/start
/run <strategy>
/status <run_id>
/approve <run_id>
/reject <run_id> <reason>
/report <run_id>
```

The bot shares the same run/event store as the Web UI. A Telegram-created run can be inspected at `/runs/<run_id>`.
