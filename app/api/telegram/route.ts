import { NextResponse } from 'next/server';
import { approveRun, rejectRun, startRun, type RunProgress } from '@/agent/agent';
import { getRun } from '@/lib/store';
import {
  answerCallback,
  editText,
  isConfigured,
  sendButtons,
  sendText,
  type InlineKeyboard,
} from '@/lib/telegram';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

type TgMessage = {
  chat: { id: number };
  message_id?: number;
  text?: string;
  from?: { id: number };
};

type TgUpdate = {
  message?: TgMessage;
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number };
    message?: TgMessage;
  };
};

// Progress events worth surfacing to the chat. Filtered so we edit one message
// rather than spamming on every internal stage.
const PROGRESS_TYPES = new Set([
  'strategy.parsed',
  'skill_hub.evidence.completed',
  'backtest.completed',
  'backtest.failed',
  'risk.scored',
  'approval.requested',
  'run.blocked',
]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TgUpdate;
  const isTgUpdate = !!(body.message || body.callback_query);

  // Fallback path: a non-Telegram caller (e.g. manual curl testing) gets a
  // JSON shape describing what would be sent, so the route stays testable
  // without a configured bot token.
  if (!isTgUpdate) {
    return NextResponse.json({ ok: true, configured: isConfigured(), message: 'Send a Telegram update (message or callback_query).' });
  }

  if (body.callback_query) {
    await handleCallback(body.callback_query);
  } else if (body.message) {
    await handleMessage(body.message);
  }

  // Telegram only needs a 200; it ignores the body.
  return NextResponse.json({});
}

async function handleMessage(message: TgMessage) {
  const chatId = message.chat.id;
  const text = (message.text ?? '').trim();

  if (text === '/start' || text === '/help' || text === '') {
    await sendText(
      chatId,
      [
        '*TradeTrace bot*',
        '',
        '`/run <strategy>` — create a run, stream stage progress, and get inline Approve/Reject buttons',
        '`/status <run_id>` — current status and decision',
        '`/report <run_id>` — executive summary',
      ].join('\n'),
    );
    return;
  }

  if (text.startsWith('/status ')) {
    const runId = text.replace('/status ', '').trim();
    const bundle = await getRun(runId);
    await sendText(
      chatId,
      bundle
        ? `*${runId}* — ${bundle.run.status}, decision ${bundle.run.final_decision ?? 'pending'}\n${runLink(runId)}`
        : `Run not found: \`${runId}\``,
    );
    return;
  }

  if (text.startsWith('/report ')) {
    const runId = text.replace('/report ', '').trim();
    const bundle = await getRun(runId);
    await sendText(
      chatId,
      bundle?.report
        ? `${bundle.report.executive_summary}\n${runLink(runId)}`
        : `Report not found for \`${runId}\``,
    );
    return;
  }

  if (text.startsWith('/run ')) {
    const strategy = text.replace('/run ', '').trim();
    await handleRun(chatId, strategy);
    return;
  }

  await sendText(chatId, 'Unknown command. Send /help for the list.');
}

async function handleRun(chatId: number, strategy: string) {
  // The initial message id is captured by the progress sink so later stages
  // edit the same message rather than posting new ones.
  let progressMessageId: number | null = null;

  try {
    await startRun({
      strategy,
      source: 'telegram',
      onProgress: async (progress: RunProgress) => {
        await onProgress(chatId, progress, (id) => {
          progressMessageId = id;
        }, progressMessageId);
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start run';
    if (progressMessageId) {
      await editText(chatId, progressMessageId, `✗ Run failed: ${message}`);
    } else {
      await sendText(chatId, `✗ Run failed: ${message}`);
    }
  }
}

async function onProgress(
  chatId: number,
  progress: RunProgress,
  setMessageId: (id: number) => void,
  currentMessageId: number | null,
) {
  const { type, status, message, detail } = progress;
  const runId = progress.runId;

  // First meaningful event (or the very first event) seeds the message.
  if (!currentMessageId) {
    const keyboard = status === 'pending' ? approveRejectKeyboard(runId) : undefined;
    const id = keyboard
      ? await sendButtons(chatId, `*${runId}* — ${statusLabel(status)}\n${message}`, keyboard)
      : await sendText(chatId, `*${runId}* — ${statusLabel(status)}\n${message}`);
    if (id) setMessageId(id);
    return;
  }

  if (!PROGRESS_TYPES.has(type)) return;

  const reachedApproval = type === 'approval.requested';
  const reachedBlock = type === 'run.blocked';
  const keyboard = reachedApproval ? approveRejectKeyboard(runId) : undefined;
  const lines = [`*${runId}* — ${statusLabel(status)}`, message];
  if (detail) lines.push(`\`${detail}\``);
  if (reachedBlock) lines.push(runLink(runId));
  await editText(chatId, currentMessageId, lines.join('\n'), keyboard);
}

async function handleCallback(callback: NonNullable<TgUpdate['callback_query']>) {
  const data = callback.data ?? '';
  const chatId = callback.message?.chat.id ?? 0;
  const messageId = callback.message?.message_id ?? null;
  const reviewerRef = reviewer(chatId, callback.from?.id);

  await answerCallback(callback.id);

  const match = data.match(/^(approve|reject):(.+)$/);
  if (!match) return;
  const [, action, runId] = match;

  try {
    if (action === 'approve') {
      const bundle = await approveRun(runId, 'Approved via Telegram.', reviewerRef, 'telegram');
      if (messageId) await editText(chatId, messageId, `*${runId}* — ✓ Approved\nStatus: ${bundle.run.status}\n${runLink(runId)}`);
    } else {
      const bundle = await rejectRun(runId, 'Rejected via Telegram.', reviewerRef, 'telegram');
      if (messageId) await editText(chatId, messageId, `*${runId}* — ✗ Rejected\nStatus: ${bundle.run.status}\n${runLink(runId)}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'failed';
    if (messageId) await editText(chatId, messageId, `Action failed: ${reason}`);
  }
}

function reviewer(chatId: number, fromId?: number) {
  return `telegram:${chatId}:${fromId ?? 'unknown'}`;
}

function approveRejectKeyboard(runId: string): InlineKeyboard {
  return [
    [
      { text: '✓ Approve', callback_data: `approve:${runId}` },
      { text: '✗ Reject', callback_data: `reject:${runId}` },
    ],
  ];
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    started: 'running',
    completed: '✓ done',
    failed: '✗ failed',
    blocked: '⨯ blocked',
    pending: '⏳ awaiting approval',
  };
  return map[status] ?? status;
}

function runLink(runId: string) {
  return `[Open run](${appUrl}/runs/${runId})`;
}
