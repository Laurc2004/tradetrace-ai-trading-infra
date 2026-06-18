import { NextResponse } from 'next/server';
import { approveRun, rejectRun, startRun } from '@/agent/agent';
import { getRun } from '@/lib/store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const text = extractTelegramText(body);
  const chatId = body?.message?.chat?.id ?? body?.callback_query?.message?.chat?.id ?? 'unknown';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (text.startsWith('/run ')) {
    const strategy = text.replace('/run ', '').trim();
    const bundle = await startRun({ strategy, source: 'telegram' });
    return NextResponse.json({
      method: 'sendMessage',
      chat_id: chatId,
      text: `Run ${bundle.run.run_id} created. Status: ${bundle.run.status}. Open ${appUrl}/runs/${bundle.run.run_id}`,
    });
  }

  if (text.startsWith('/status ')) {
    const runId = text.replace('/status ', '').trim();
    const bundle = await getRun(runId);
    return NextResponse.json({
      method: 'sendMessage',
      chat_id: chatId,
      text: bundle ? `Run ${runId}: ${bundle.run.status}, decision ${bundle.run.final_decision ?? 'pending'}` : `Run not found: ${runId}`,
    });
  }

  if (text.startsWith('/approve ')) {
    const runId = text.replace('/approve ', '').trim();
    const bundle = await approveRun(runId, 'Approved from Telegram.', `telegram:${chatId}`, 'telegram');
    return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `Approved ${runId}. Status: ${bundle.run.status}. ${appUrl}/runs/${runId}` });
  }

  if (text.startsWith('/reject ')) {
    const [, runId, ...rest] = text.split(' ');
    const bundle = await rejectRun(runId, rest.join(' ') || 'Rejected from Telegram.', `telegram:${chatId}`, 'telegram');
    return NextResponse.json({ method: 'sendMessage', chat_id: chatId, text: `Rejected ${runId}. Status: ${bundle.run.status}. ${appUrl}/runs/${runId}` });
  }

  if (text.startsWith('/report ')) {
    const runId = text.replace('/report ', '').trim();
    const bundle = await getRun(runId);
    return NextResponse.json({
      method: 'sendMessage',
      chat_id: chatId,
      text: bundle?.report ? `${bundle.report.executive_summary}\n${appUrl}/runs/${runId}` : `Report not found for ${runId}`,
    });
  }

  return NextResponse.json({
    method: 'sendMessage',
    chat_id: chatId,
    text: 'TradeTrace commands: /run <strategy>, /status <run_id>, /approve <run_id>, /reject <run_id> <reason>, /report <run_id>',
  });
}

function extractTelegramText(body: any): string {
  return String(body?.message?.text ?? body?.callback_query?.data ?? '').trim();
}
