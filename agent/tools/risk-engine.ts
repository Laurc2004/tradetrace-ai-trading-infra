import { clamp, makeId, nowIso } from '@/lib/id';
import type { BacktestResult, EvidencePack, RiskAssessment, RiskLevel, RiskRecommendation, RiskRuleHit, StrategySpec } from '@/lib/types';

export function assessRisk(runId: string, strategy: StrategySpec, backtest: BacktestResult, evidence?: EvidencePack): RiskAssessment {
  const hits: RiskRuleHit[] = [];
  const strategyText = JSON.stringify(strategy.structured_strategy).toLowerCase();

  addIf(hits, /martingale|摊平|unlimited|不断加仓|averaging/.test(strategyText), {
    rule_id: 'no-martingale',
    label: 'Martingale or unlimited averaging-down behavior',
    severity: 'critical',
    points: 45,
    evidence: 'Strategy implies adding to losing positions until rebound.',
  });

  addIf(hits, /high leverage|杠杆|leverage/.test(strategyText), {
    rule_id: 'high-leverage',
    label: 'High leverage requested',
    severity: 'high',
    points: 30,
    evidence: 'Strategy asks for leverage or fast loss recovery.',
  });

  addIf(hits, !strategy.structured_strategy.stop_loss, {
    rule_id: 'missing-stop-loss',
    label: 'Missing stop loss',
    severity: 'medium',
    points: 18,
    evidence: 'No explicit stop-loss constraint was parsed.',
  });

  addIf(hits, backtest.max_drawdown > 25, {
    rule_id: 'drawdown-critical',
    label: 'Critical backtest drawdown',
    severity: 'critical',
    points: 40,
    evidence: `Max drawdown is ${backtest.max_drawdown}%.`,
  });

  addIf(hits, backtest.max_drawdown > 15 && backtest.max_drawdown <= 25, {
    rule_id: 'drawdown-review',
    label: 'Elevated backtest drawdown',
    severity: 'medium',
    points: 16,
    evidence: `Max drawdown is ${backtest.max_drawdown}%.`,
  });

  addIf(hits, backtest.sharpe < 0.5, {
    rule_id: 'low-sharpe',
    label: 'Weak Sharpe ratio',
    severity: 'medium',
    points: 15,
    evidence: `Sharpe is ${backtest.sharpe}.`,
  });

  addIf(hits, backtest.trade_count < 10, {
    rule_id: 'thin-sample',
    label: 'Thin trade sample',
    severity: 'low',
    points: 8,
    evidence: `Only ${backtest.trade_count} trades in backtest.`,
  });

  addIf(hits, strategy.structured_strategy.unknowns.length > 0, {
    rule_id: 'ambiguous-strategy',
    label: 'Ambiguous strategy fields',
    severity: 'medium',
    points: 14,
    evidence: strategy.structured_strategy.unknowns.join('; '),
  });

  addIf(hits, evidence?.aggregate_signal === 'risk-off', {
    rule_id: 'skill-evidence-risk-off',
    label: 'Bitget skill evidence is risk-off',
    severity: 'medium',
    points: 18,
    evidence: evidence?.risk_flags.slice(0, 3).join('; ') || 'Evidence Pack aggregate signal is risk-off.',
  });

  addIf(hits, (evidence?.risk_flags.length ?? 0) >= 3, {
    rule_id: 'multiple-skill-risk-flags',
    label: 'Multiple Bitget skill risk flags',
    severity: 'medium',
    points: 12,
    evidence: `${evidence?.risk_flags.length ?? 0} evidence risk flags were collected before approval.`,
  });

  const score = clamp(hits.reduce((sum, hit) => sum + hit.points, 0), 0, 100);
  const critical = hits.some((hit) => hit.severity === 'critical');
  const level: RiskLevel = critical || score >= 70 ? 'High' : score >= 30 ? 'Medium' : 'Low';
  const recommendation: RiskRecommendation = level === 'High' ? 'Block' : level === 'Medium' ? 'Review' : 'Go';

  return {
    risk_id: makeId('risk'),
    run_id: runId,
    score,
    level,
    recommendation,
    triggered_rules: hits,
    reasons: hits.length ? hits.map((hit) => `${hit.label}: ${hit.evidence}`) : ['No major risk rules were triggered.'],
    created_at: nowIso(),
  };
}

function addIf(hits: RiskRuleHit[], condition: boolean, hit: RiskRuleHit) {
  if (condition) hits.push(hit);
}
