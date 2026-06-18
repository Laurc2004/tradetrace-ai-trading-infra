import { makeId, nowIso } from '@/lib/id';
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
import type { Run, RunBundle, SourceChannel } from '@/lib/types';
import { createInitialApproval, decideApproval } from './tools/approval-gate';
import { collectEvidencePack } from './tools/bitget-skill-evidence';
import { runPlaybookBacktest } from './tools/playbook-backtest';
import { parseStrategyWithQwen } from './tools/qwen-strategy-parser';
import { generateReport } from './tools/report-generator';
import { assessRisk } from './tools/risk-engine';
import { event } from './tools/trace-event';

export async function startRun(input: { strategy: string; source?: SourceChannel; market?: string }): Promise<RunBundle> {
  const runId = makeId('run');
  const run: Run = {
    run_id: runId,
    source_channel: input.source ?? 'web',
    status: 'created',
    user_input: input.strategy,
    market: input.market ?? inferMarket(input.strategy),
    started_at: nowIso(),
  };

  await upsertRun(run);
  await appendEvent(
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
  const parseStart = Date.now();
  const strategy = await parseStrategyWithQwen(runId, input.strategy);
  await saveStrategy(strategy);
  await appendEvent(
    event({
      runId,
      type: 'strategy.parsed',
      actor: 'qwen',
      status: 'completed',
      input: input.strategy,
      output: `${strategy.structured_strategy.symbol} ${strategy.structured_strategy.direction} ${strategy.structured_strategy.timeframe}`,
      duration: Date.now() - parseStart,
    }),
  );

  await updateRun(runId, { status: 'collecting_evidence' });
  await appendEvent(
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
  await appendEvent(
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
  );

  await updateRun(runId, { status: 'backtesting' });
  await appendEvent(
    event({
      runId,
      type: 'playbook.backtest.started',
      actor: 'playbook',
      status: 'started',
      input: JSON.stringify(strategy.structured_strategy),
      output: 'Backtest request prepared.',
    }),
  );
  const backtestStart = Date.now();
  const backtest = await runPlaybookBacktest(runId, strategy);
  await saveBacktest(backtest);
  await appendEvent(
    event({
      runId,
      type: 'playbook.backtest.completed',
      actor: 'playbook',
      status: 'completed',
      input: strategy.strategy_id,
      output: `PnL ${backtest.pnl}%, Sharpe ${backtest.sharpe}, Max DD ${backtest.max_drawdown}%`,
      duration: Date.now() - backtestStart,
      rawRef: backtest.raw_summary_ref,
    }),
  );

  await updateRun(runId, { status: 'risk_review' });
  const risk = assessRisk(runId, strategy, backtest, evidence);
  await saveRisk(risk);
  await appendEvent(
    event({
      runId,
      type: 'risk.scored',
      actor: 'risk_engine',
      status: risk.recommendation === 'Block' ? 'blocked' : 'completed',
      input: `${backtest.backtest_id}/${strategy.strategy_id}`,
      output: `${risk.level} risk (${risk.score}/100), recommendation: ${risk.recommendation}`,
    }),
  );

  const approval = createInitialApproval(runId, risk, input.source ?? 'web');
  await saveApproval(approval);
  await appendEvent(
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
    await completeReport(runId);
  } else {
    await executeReplay(runId);
  }

  const bundle = await getRun(runId);
  if (!bundle) throw new Error(`Run missing after creation: ${runId}`);
  return bundle;
}

export async function approveRun(runId: string, reason: string, reviewer = 'web-user', channel: SourceChannel = 'web') {
  const bundle = await getRun(runId);
  if (!bundle) throw new Error(`Run not found: ${runId}`);
  if (bundle.run.status !== 'awaiting_approval') return bundle;

  const approval = decideApproval(runId, 'approved', reason, reviewer, channel);
  await saveApproval(approval);
  await appendEvent(
    event({ runId, type: 'approval.accepted', actor: 'approval', status: 'completed', input: reason, output: 'Reviewer approved execution.' }),
  );
  return executeReplay(runId);
}

export async function rejectRun(runId: string, reason: string, reviewer = 'web-user', channel: SourceChannel = 'web') {
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
}

export async function executeReplay(runId: string) {
  await updateRun(runId, { status: 'executing', final_decision: 'Go' });
  await appendEvent(
    event({
      runId,
      type: 'execution.replay.started',
      actor: 'execution',
      status: 'started',
      input: 'Replay execution adapter',
      output: 'Replay execution started using recorded backtest-compatible events.',
    }),
  );
  await appendEvent(
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
  await completeReport(runId);
  return getRunOrThrow(runId);
}

export async function completeReport(runId: string) {
  const bundle = await getRunOrThrow(runId);
  const report = await generateReport(bundle);
  await saveReport(report);
  await appendEvent(
    event({
      runId,
      type: 'run.report.generated',
      actor: 'reporter',
      status: 'completed',
      input: 'Run evidence bundle',
      output: report.executive_summary,
    }),
  );
  return report;
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
