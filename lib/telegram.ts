/**
 * Minimal Telegram Bot API client.
 *
 * Each helper returns `null` when TELEGRAM_BOT_TOKEN is unset, so callers in
 * Web-only mode degrade to no-ops rather than throwing. Network/Telegram API
 * errors are swallowed and logged — a failing delivery must never break a run.
 */

const API_BASE = 'https://api.telegram.org';

export type InlineKeyboard = {
  text: string;
  callback_data: string;
}[][];

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

async function call(method: string, params: Record<string, unknown>): Promise<unknown | null> {
  const botToken = token();
  if (!botToken) return null;
  try {
    const response = await fetch(`${API_BASE}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  } catch (error) {
    console.error(`[telegram] ${method} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function sendText(chatId: number | string, text: string): Promise<number | null> {
  const result = await call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
  return (result as { result?: { message_id?: number } } | null)?.result?.message_id ?? null;
}

export async function sendButtons(
  chatId: number | string,
  text: string,
  keyboard: InlineKeyboard,
): Promise<number | null> {
  const result = await call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: keyboard },
  });
  return (result as { result?: { message_id?: number } } | null)?.result?.message_id ?? null;
}

export async function editText(
  chatId: number | string,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<unknown> {
  return call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export async function answerCallback(callbackQueryId: string, text?: string): Promise<unknown> {
  return call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

export type BotCommand = { command: string; description: string };

/**
 * Register the bot's command menu (the autocomplete shown when the user types
 * "/"). Safe to call repeatedly — it overwrites the previous menu.
 */
export async function setCommands(commands: BotCommand[]): Promise<unknown | null> {
  return call('setMyCommands', { commands });
}

/** Default command menu for the TradeTrace bot. */
export const DEFAULT_COMMANDS: BotCommand[] = [
  { command: 'run', description: 'Create a run: /run <strategy>' },
  { command: 'status', description: 'Check a run: /status <run_id>' },
  { command: 'report', description: 'Executive summary: /report <run_id>' },
  { command: 'help', description: 'Show available commands' },
];

/**
 * Register the default command menu. Returns true on success, false if the
 * token is unset or the Telegram API rejected the call.
 */
export async function registerDefaultCommands(): Promise<boolean> {
  const result = await setCommands(DEFAULT_COMMANDS);
  return (result as { ok?: boolean } | null)?.ok === true;
}

export function isConfigured(): boolean {
  return !!token();
}
