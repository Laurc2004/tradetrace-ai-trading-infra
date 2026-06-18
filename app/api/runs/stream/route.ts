import { NextResponse } from 'next/server';
import { startRun } from '@/agent/agent';

const encoder = new TextEncoder();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const strategy = String(body.strategy ?? '').trim();
  if (!strategy) {
    return NextResponse.json({ error: 'strategy is required' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: unknown) {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      }

      try {
        const bundle = await startRun({
          strategy,
          source: 'web',
          market: body.market,
          onProgress: (progress) => send({ kind: 'progress', ...progress }),
        });
        send({ kind: 'done', runId: bundle.run.run_id, status: bundle.run.status });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start run';
        send({ kind: 'error', error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
    },
  });
}
