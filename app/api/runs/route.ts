import { NextResponse } from 'next/server';
import { startRun } from '@/agent/agent';
import { listRuns } from '@/lib/store';

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const strategy = String(body.strategy ?? '').trim();
    if (!strategy) {
      return NextResponse.json({ error: 'strategy is required' }, { status: 400 });
    }

    const run = await startRun({ strategy, source: 'web', market: body.market });
    return NextResponse.json(run);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start run';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
