import { makeId, nowIso, summarize } from '@/lib/id';
import type { EventActor, RunEvent } from '@/lib/types';

export function event(input: {
  runId: string;
  type: string;
  actor: EventActor;
  status: RunEvent['status'];
  input: string;
  output: string;
  duration?: number;
  rawRef?: string;
  traceParent?: string;
}): RunEvent {
  return {
    event_id: makeId('evt'),
    run_id: input.runId,
    timestamp: nowIso(),
    type: input.type,
    actor: input.actor,
    status: input.status,
    input_summary: summarize(input.input),
    output_summary: summarize(input.output),
    duration_ms: input.duration ?? 0,
    raw_ref: input.rawRef,
    trace_parent: input.traceParent,
  };
}
