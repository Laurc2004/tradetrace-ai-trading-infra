import { NextResponse } from 'next/server';
import { rejectRun } from '@/agent/agent';

type Params = { params: Promise<{ runId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { runId } = await params;
  const body = await request.json().catch(() => ({}));
  const run = await rejectRun(runId, String(body.reason ?? 'Rejected from Web UI.'), 'web-user', 'web');
  return NextResponse.json(run);
}
