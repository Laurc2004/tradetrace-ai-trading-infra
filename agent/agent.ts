import { makeId, nowIso } from '@/lib/id';
import { withRunLogging, continueRunLogging } from '@/lib/logger';
import {
  appendEvent,
  getRun,
  saveApproval,
  saveBacktest,
  saveEvidence,
  saveReport,
  saveRisk,
  saveStrategy,
  updateRun,
  upsertRun,
} from '@/lib/store';
import type { BacktestResult, EventActor, Run, RunBundle, RunEvent, SourceChannel, StrategySpec } from '@/lib/types';
import { createInitialApproval, decideApproval } from './tools/approval-gate';
import { collectEvidencePack } from './tools/bitget-skill-evidence';
import { runLocalBacktest } from './tools/local-backtest';
import { parseStrategyWithQwen } from './tools/qwen-strategy-parser';
import { generateReport } from './tools/report-generator';
import { assessRisk } from './tools/risk-engine';
import { event } from './tools/trace-event';

export type RunProgress = {
  runId: string;
  type: string;
  actor: EventActor | 'system';
  status: 'started' | 'completed' | 'failed' | 'blocked' | 'pending';
  message: string;
  detail?: string;
  timestamp: string;
};

type ProgressSink = (progress: RunProgress) => void | Promise<void>;
type ProgressEmitter = (
  type: string,
  actor: RunProgress['actor'],
  status: RunProgress['status'],
  message: string,
  detail?: string,
) => Promise<void>;
type ProgressTarget = ProgressSink | ProgressEmitter;

type StartRunInput = {
  strategy: string;
  source?: SourceChannel;
  market?: string;
  onProgress?: ProgressSink;
};

export async function startRun(input: StartRunInput): Promise<RunBundle> {
  const runId = makeId('run');
  return withRunLogging(runId, async () => {
    const progress = createProgress(runId, input.onProgress);
    const run: Run = {
      run_id: runId,
      source_channel: input.source ?? 'web',
      status: 'created',
      user_input: input.strategy,
      market: input.market ?? inferMarket(input.strategy),
      started_at: nowIso(),
    };

  await progress('system.run.created', 'system', 'started', 'Creating run object', input.strategy);
  await upsertRun(run);
  await appendAndProgress(
    progress,
    event({
      runId,
      type: 'strategy.input.received',
      actor: input.source === 'telegram' ? 'telegram' : 'user',
      status: 'completed',
      input: input.strategy,
      output: 'Strategy input accepted and run created.',
    }),
  );

  await updateRun(runId, { status: 'parsing' });
  await progress('qwen.strategy_parse.started', 'qwen', 'started', 'Calling Qwen to parse strategy', input.strategy);
  const parseStart = Date.now();
  const strategy = await parseStrategyWithQwen(runId, input.strategy);
  await saveStrategy(strategy);
  await appendAndProgress(
    progress,
    event({
      runId,
      type: 'strategy.parsed',
      actor: 'qwen',
      status: 'completed',
      input: input.strategy,
      output: `${strategy.structured_strategy.symbol} ${strategy.structured_strategy.direction} ${strategy.structured_strategy.timeframe}`,
      duration: Date.now() - parseStart,
    }),
    JSON.stringify(strategy.structured_strategy, null, 2),
  );

  await updateRun(runId, { status: 'collecting_evidence' });
  await appendAndProgress(
    progress,
    event({
      runId,
      type: 'skill_hub.evidence.started',
      actor: 'skill_hub',
      status: 'started',
      input: strategy.strategy_id,
      output: 'Collecting macro, news, sentiment, technical, and market-intel evidence.',
    }),
  );
  const evidenceStart = Date.now();
  const evidence = await collectEvidencePack(runId, strategy);
  await saveEvidence(evidence);
  await appendAndProgress(
    progress,
    event({
      runId,
      type: 'skill_hub.evidence.completed',
      actor: 'skill_hub',
      status: 'completed',
      input: strategy.strategy_id,
      output: `${evidence.skills.length} skills collected, aggregate signal: ${evidence.aggregate_signal}`,
      duration: Date.now() - evidenceStart,
      rawRef: evidence.provider,
    }),
    evidence.skills.map((skill) => `${skill.skill}: ${skill.signal} - ${skill.summary}`).join('\n'),
  );

  await updateRun(runId, { status: 'backtesting' });
  await appendAndProgress(
    progress,
    event({
      runId,
      type: 'backtest.started',
      actor: 'backtest',
      status: 'started',
      input: JSON.stringify(strategy.structured_strategy),
      output: 'Fetching Bitget public klines and running the deterministic local backtest.',
    }),
  );
  const backtestStart = Date.now();
  const backtest = await runBacktest(runId, strategy, progress);
  await saveBacktest(backtest);
  await appendAndProgress(
    progress,
    event({
      runId,
      type: backtest.status === 'failed' ? 'backtest.failed' : 'backtest.completed',
      actor: 'backtest',
      status: backtest.status === 'failed' ? 'failed' : 'completed',
      input: strategy.strategy_id,
      output:
        backtest.status === 'failed'
          ? `Local backtest failed: ${backtest.raw_summary_ref}`
          : `PnL ${backtest.pnl}%, Sharpe ${backtest.sharpe}, Max DD ${backtest.max_drawdown}%, ${backtest.trade_count} trades`,
      duration: Date.now() - backtestStart,
      rawRef: backtest.raw_summary_ref,
    }),
    `provider=${backtest.provider}; period=${backtest.period}; status=${backtest.status ?? 'live'}; raw_ref=${backtest.raw_summary_ref}`,
  );

  await updateRun(runId, { status: 'risk_review' });
  await progress('risk.scoring.started', 'risk_engine', 'started', 'Scoring deterministic risk rules');
  const risk = assessRisk(runId, strategy, backtest, evidence);
  await saveRisk(risk);
  await appendAndProgress(
    progress,
    event({
      runId,
      type: 'risk.scored',
      actor: 'risk_engine',
      status: risk.recommendation === 'Block' ? 'blocked' : 'completed',
      input: `${backtest.backtest_id}/${strategy.strategy_id}`,
      output: `${risk.level} risk (${risk.score}/100), recommendation: ${risk.recommendation}`,
    }),
    risk.reasons.join('\n'),
  );

  const approval = createInitialApproval(runId, risk, input.source ?? 'web');
  await saveApproval(approval);
  await appendAndProgress(
    progress,
    event({
      runId,
      type: approval.decision === 'pending' ? 'approval.requested' : approval.decision === 'blocked' ? 'run.blocked' : 'approval.not_required',
      actor: 'approval',
      status: approval.decision === 'pending' ? 'pending' : approval.decision === 'blocked' ? 'blocked' : 'completed',
      input: risk.recommendation,
      output: approval.reason,
    }),
  );

  if (approval.decision === 'pending') {
    await updateRun(runId, { status: 'awaiting_approval', final_decision: 'Review' });
  } else if (approval.decision === 'blocked') {
    await updateRun(runId, { status: 'blocked', final_decision: 'Block', ended_at: nowIso() });
    await completeReport(runId, progress);
  } else {
    await executeReplay(runId, progress);
  }

  const bundle = await getRun(runId);
  if (!bundle) throw new Error(`Run missing after creation: ${runId}`);
  await progress('system.run.ready', 'system', 'completed', 'Run is ready', runId);
  return bundle;
  });
}

export async function approveRun(runId: string, reason: string, reviewer = 'web-user', channel: SourceChannel = 'web') {
  return withRunLogging(runId, async () => {
    const bundle = await getRun(runId);
    if (!bundle) throw new Error(`Run not found: ${runId}`);
    if (bundle.run.status !== 'awaiting_approval') return bundle;

    const approval = decideApproval(runId, 'approved', reason, reviewer, channel);
    await saveApproval(approval);
    await appendEvent(
      event({ runId, type: 'approval.accepted', actor: 'approval', status: 'completed', input: reason, output: 'Reviewer approved execution.' }),
    );
    return executeReplay(runId);
  });
}

export async function rejectRun(runId: string, reason: string, reviewer = 'web-user', channel: SourceChannel = 'web') {
  return withRunLogging(runId, async () => {
    const bundle = await getRun(runId);
    if (!bundle) throw new Error(`Run not found: ${runId}`);
    const approval = decideApproval(runId, 'rejected', reason, reviewer, channel);
    await saveApproval(approval);
    await updateRun(runId, { status: 'blocked', final_decision: 'Block', ended_at: nowIso() });
    await appendEvent(
      event({ runId, type: 'approval.rejected', actor: 'approval', status: 'blocked', input: reason, output: 'Reviewer rejected execution.' }),
    );
    await completeReport(runId);
    return getRunOrThrow(runId);
  });
}

export async function executeReplay(runId: string, onProgress?: ProgressTarget) {
  return continueRunLogging(runId, async () => {
    const progress = createProgress(runId, onProgress);
    await updateRun(runId, { status: 'executing', final_decision: 'Go' });
    await appendAndProgress(
      progress,
      event({
        runId,
        type: 'execution.replay.started',
        actor: 'execution',
        status: 'started',
        input: 'Replay execution adapter',
        output: 'Replay execution started using recorded backtest-compatible events.',
      }),
    );
    await appendAndProgress(
      progress,
      event({
        runId,
        type: 'execution.updated',
        actor: 'execution',
        status: 'completed',
        input: 'Replay execution adapter',
        output: 'Replay completed. No real-money trade was sent.',
        duration: 350,
      }),
    );
    await updateRun(runId, { status: 'completed', ended_at: nowIso() });
    await completeReport(runId, progress);
    return getRunOrThrow(runId);
  });
}

export async function completeReport(runId: string, onProgress?: ProgressTarget) {
  return continueRunLogging(runId, async () => {
    const progress = createProgress(runId, onProgress);
    const bundle = await getRunOrThrow(runId);
    await progress('qwen.report.started', 'reporter', 'started', 'Calling Qwen to generate post-run report');
    const report = await generateReport(bundle);
    await saveReport(report);
    await appendAndProgress(
      progress,
      event({
        runId,
        type: 'run.report.generated',
        actor: 'reporter',
        status: 'completed',
        input: 'Run evidence bundle',
        output: report.executive_summary,
      }),
      report.key_findings.join('\n'),
    );
    return report;
  });
}

async function getRunOrThrow(runId: string) {
  const bundle = await getRun(runId);
  if (!bundle) throw new Error(`Run not found: ${runId}`);
  return bundle;
}

function inferMarket(strategy: string) {
  const lower = strategy.toLowerCase();
  if (lower.includes('eth')) return 'ETHUSDT';
  if (lower.includes('sol')) return 'SOLUSDT';
  return 'BTCUSDT';
}

/**
 * Run the local deterministic backtest. On failure, return a BacktestResult
 * flagged `status: 'failed'` with zeroed metrics and the real error in
 * `raw_summary_ref` — we do NOT silently fabricate plausible metrics. The risk
 * engine and UI treat a failed backtest explicitly (the orchestrator still
 * flows through risk review so the run is auditable, but the failure is
 * surfaced rather than hidden behind fake PnL/Sharpe).
 */
async function runBacktest(runId: string, strategy: StrategySpec, onProgress?: ProgressTarget): Promise<BacktestResult> {
  const progress = createProgress(runId, onProgress);
  try {
    await progress('backtest.fetch.started', 'backtest', 'started', 'Fetching Bitget public klines and simulating strategy');
    const result = await runLocalBacktest(runId, strategy);
    await progress('backtest.fetch.completed', 'backtest', 'completed', 'Local backtest completed', result.raw_summary_ref);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown backtest failure';
    await appendAndProgress(
      progress,
      event({
        runId,
        type: 'backtest.fetch.failed',
        actor: 'backtest',
        status: 'failed',
        input: strategy.strategy_id,
        output: `Local backtest failed: ${message}`,
        rawRef: 'local-backtest-error',
      }),
    );
    return {
      backtest_id: makeId('failed_backtest'),
      run_id: runId,
      provider: 'local_deterministic',
      period: 'unavailable',
      pnl: 0,
      sharpe: 0,
      win_rate: 0,
      max_drawdown: 0,
      trade_count: 0,
      raw_summary_ref: `local-backtest-failed:${message.slice(0, 160)}`,
      status: 'failed',
      created_at: nowIso(),
    };
  }
}

function createProgress(runId: string, onProgress?: ProgressTarget): ProgressEmitter {
  if (!onProgress) {
    return async () => undefined;
  }
  if (onProgress.length >= 4) {
    return onProgress as ProgressEmitter;
  }
  return async (
    type: string,
    actor: RunProgress['actor'],
    status: RunProgress['status'],
    message: string,
    detail?: string,
  ) => {
    await (onProgress as ProgressSink)({ runId, type, actor, status, message, detail, timestamp: nowIso() });
  };
}

async function appendAndProgress(progress: ReturnType<typeof createProgress>, runEvent: RunEvent, detail?: string) {
  await appendEvent(runEvent);
  await progress(runEvent.type, runEvent.actor, runEvent.status, runEvent.output_summary, detail ?? runEvent.input_summary);
}
