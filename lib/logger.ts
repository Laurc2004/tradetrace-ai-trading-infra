import { AsyncLocalStorage } from 'node:async_hooks';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { redactObject } from './redaction';

export function logInfo(scope: string, message: string, meta: Record<string, unknown> = {}) {
  writeLog('info', scope, message, meta);
}

export function logWarn(scope: string, message: string, meta: Record<string, unknown> = {}) {
  writeLog('warn', scope, message, meta);
}

export function logError(scope: string, message: string, meta: Record<string, unknown> = {}) {
  writeLog('error', scope, message, meta);
}

export function errorMeta(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

type RunLogContext = {
  runId: string;
  logDir: string;
  startedAt: string;
  /** Per-scope call counts — the "call volume" surfaced in summary.json. */
  counts: Map<string, number>;
};

const runStorage = new AsyncLocalStorage<RunLogContext>();

const logsRoot = path.join(process.cwd(), 'logs');

function timestampStamp(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
  );
}

/**
 * Run `fn` inside a per-run logging context. Every log line emitted by code
 * running under `fn` (including in tools and providers, with no call-site
 * changes) is also appended to `logs/<runId>/<YYYYMMDD-HHMMSS>/run.log`, and a
 * `summary.json` with per-scope call counts is written when `fn` settles.
 *
 * Re-entering with the same `runId` (e.g. an async approval that resumes a run
 * in a fresh request) creates a new timestamped folder for that leg — runId
 * stays the grouping key.
 */
export async function withRunLogging<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  const stamp = timestampStamp(new Date());
  const logDir = path.join(logsRoot, runId, stamp);
  await fs.mkdir(logDir, { recursive: true });
  const context: RunLogContext = {
    runId,
    logDir,
    startedAt: new Date().toISOString(),
    counts: new Map(),
  };
  try {
    return await runStorage.run(context, fn);
  } finally {
    await writeSummary(context).catch((err) => {
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', scope: 'logger', message: 'writeSummary failed', error: err instanceof Error ? err.message : String(err) }));
    });
  }
}

/**
 * Like {@link withRunLogging}, but reuses the caller's run-logging context when
 * one is already active (e.g. `completeReport` called from within `startRun`).
 * This keeps a single logical run's logs in one folder instead of nesting
 * folders for each internal step. Only a top-level entry point that has no
 * active context — an async approval/resume landing in a fresh request — opens
 * a new timestamped folder.
 */
export async function continueRunLogging<T>(runId: string, fn: () => Promise<T>): Promise<T> {
  if (runStorage.getStore()) return fn();
  return withRunLogging(runId, fn);
}

async function writeSummary(context: RunLogContext) {
  const counts = Object.fromEntries([...context.counts.entries()].sort());
  const summary = {
    run_id: context.runId,
    started_at: context.startedAt,
    ended_at: new Date().toISOString(),
    log_file: 'run.log',
    call_counts_by_scope: counts,
    total_log_calls: Object.values(counts).reduce((sum, n) => sum + n, 0),
  };
  await fs.writeFile(path.join(context.logDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

function writeLog(level: 'info' | 'warn' | 'error', scope: string, message: string, meta: Record<string, unknown>) {
  const payload = redactObject({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...meta,
  });
  const line = JSON.stringify(payload);

  // Console output is unchanged.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  // If inside a run, also persist to the run's log file and tally the call.
  const context = runStorage.getStore();
  if (context) {
    context.counts.set(scope, (context.counts.get(scope) ?? 0) + 1);
    // Fire and forget — never let disk I/O break the run.
    fs.appendFile(path.join(context.logDir, 'run.log'), `${line}\n`, 'utf8').catch(() => undefined);
  }
}
