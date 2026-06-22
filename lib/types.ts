export type RunStatus =
  | 'created'
  | 'parsing'
  | 'collecting_evidence'
  | 'backtesting'
  | 'risk_review'
  | 'awaiting_approval'
  | 'executing'
  | 'completed'
  | 'blocked'
  | 'failed';

export type SourceChannel = 'web' | 'telegram' | 'replay';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type RiskRecommendation = 'Go' | 'Review' | 'Block';
export type ApprovalDecision = 'approved' | 'rejected' | 'blocked' | 'not_required' | 'pending';

export type EventActor =
  | 'user'
  | 'agent'
  | 'qwen'
  | 'backtest'
  | 'skill_hub'
  | 'risk_engine'
  | 'approval'
  | 'execution'
  | 'reporter'
  | 'telegram';

export type BitgetSkillName = 'macro-analyst' | 'news-briefing' | 'sentiment-analyst' | 'technical-analysis' | 'market-intel';

export interface StructuredStrategy {
  symbol: string;
  timeframe: string;
  direction: 'long' | 'short' | 'both' | 'unknown';
  entry_conditions: string[];
  exit_conditions: string[];
  stop_loss: string | null;
  take_profit: string | null;
  position_limit: string | null;
  risk_constraints: string[];
  unknowns: string[];
}

export interface Run {
  run_id: string;
  source_channel: SourceChannel;
  status: RunStatus;
  user_input: string;
  market: string;
  started_at: string;
  ended_at?: string;
  final_decision?: RiskRecommendation | 'failed';
  report_id?: string;
}

export interface StrategySpec {
  strategy_id: string;
  run_id: string;
  raw_prompt: string;
  structured_strategy: StructuredStrategy;
  confidence_notes: string[];
  created_at: string;
}

export interface SkillEvidence {
  skill: BitgetSkillName;
  status: 'live' | 'fallback' | 'unavailable';
  signal: 'bullish' | 'bearish' | 'neutral' | 'risk-off' | 'risk-on' | 'mixed';
  confidence: number;
  summary: string;
  key_points: string[];
  raw_ref: string;
}

export interface EvidencePack {
  evidence_id: string;
  run_id: string;
  provider: 'bitget_agent_hub' | 'qwen_skill_persona' | 'fallback';
  skills: SkillEvidence[];
  aggregate_signal: 'bullish' | 'bearish' | 'neutral' | 'risk-off' | 'risk-on' | 'mixed';
  risk_flags: string[];
  created_at: string;
}

export interface BacktestTrade {
  side: 'long' | 'short';
  entry_ts: number;
  entry_price: number;
  exit_ts: number;
  exit_price: number;
  return_pct: number; // per-trade fractional return (e.g. 0.012 = +1.2%)
  reason: 'signal-flip' | 'stop-loss' | 'take-profit';
}

export interface BacktestCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BacktestChart {
  candles: BacktestCandle[]; // chronological, same length as equity_curve
  equity_curve: number[]; // per-bar equity indexed to 1.0 start
  trades: BacktestTrade[];
}

export interface BacktestResult {
  backtest_id: string;
  run_id: string;
  provider: 'local_deterministic' | 'replay_fixture' | 'degraded_estimate' | 'bitget_playbook';
  period: string;
  pnl: number;
  sharpe: number;
  win_rate: number;
  max_drawdown: number;
  trade_count: number;
  raw_summary_ref: string;
  status?: 'live' | 'failed';
  notes?: string[];
  chart?: BacktestChart; // candle series + equity curve + per-trade markers (omitted on legacy fixtures)
  created_at: string;
}

export interface RiskRuleHit {
  rule_id: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  points: number;
  evidence: string;
}

export interface RiskAssessment {
  risk_id: string;
  run_id: string;
  score: number;
  level: RiskLevel;
  recommendation: RiskRecommendation;
  triggered_rules: RiskRuleHit[];
  reasons: string[];
  created_at: string;
}

export interface ApprovalRecord {
  approval_id: string;
  run_id: string;
  required: boolean;
  decision: ApprovalDecision;
  reviewer: string;
  reason: string;
  channel: SourceChannel;
  timestamp: string;
}

export interface RunEvent {
  event_id: string;
  run_id: string;
  timestamp: string;
  type: string;
  actor: EventActor;
  status: 'started' | 'completed' | 'failed' | 'blocked' | 'pending';
  input_summary: string;
  output_summary: string;
  duration_ms: number;
  raw_ref?: string;
  trace_parent?: string;
}

export interface Report {
  report_id: string;
  run_id: string;
  executive_summary: string;
  key_findings: string[];
  risk_notes: string[];
  audit_trail: string[];
  next_actions: string[];
  created_at: string;
}

export interface RunBundle {
  run: Run;
  strategy?: StrategySpec;
  evidence?: EvidencePack;
  backtest?: BacktestResult;
  risk?: RiskAssessment;
  approval?: ApprovalRecord;
  report?: Report;
  events: RunEvent[];
}
