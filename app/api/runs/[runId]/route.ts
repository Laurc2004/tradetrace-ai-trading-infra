import { NextResponse } from 'next/server';
import { getRun } from '@/lib/store';

type Params = { params: Promise<{ runId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  return NextResponse.json(run);
}
