import { NextResponse } from 'next/server';
import { completeReport } from '@/agent/agent';

type Params = { params: Promise<{ runId: string }> };

export async function POST(_: Request, { params }: Params) {
  const { runId } = await params;
  const report = await completeReport(runId);
  return NextResponse.json(report);
}
