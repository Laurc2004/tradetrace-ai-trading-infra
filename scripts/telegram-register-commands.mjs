#!/usr/bin/env node
/**
 * Register the TradeTrace bot's command menu via Telegram setMyCommands.
 *
 *   TELEGRAM_BOT_TOKEN=... node scripts/telegram-register-commands.mjs
 *
 * After running, /run /status /report /help appear in the bot's command
 * autocomplete in the Telegram app. Safe to re-run; it overwrites the menu.
 *
 * Token is read from process.env so this script has no project-module deps.
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Export it in your shell or .env first.');
  process.exit(1);
}

const commands = [
  { command: 'run', description: 'Create a run: /run <strategy>' },
  { command: 'status', description: 'Check a run: /status <run_id>' },
  { command: 'report', description: 'Executive summary: /report <run_id>' },
  { command: 'help', description: 'Show available commands' },
];

const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ commands }),
});
const json = await res.json();
if (json.ok) {
  console.log(`Commands registered (${commands.length}): ${commands.map((c) => '/' + c.command).join(', ')}`);
} else {
  console.error('Telegram rejected setMyCommands:', json);
  process.exit(1);
}
