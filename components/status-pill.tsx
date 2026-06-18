import type { RunStatus } from '@/lib/types';

const labels: Record<RunStatus, string> = {
  created: 'Created',
  parsing: 'Parsing',
  collecting_evidence: 'Collecting evidence',
  backtesting: 'Backtesting',
  risk_review: 'Risk review',
  awaiting_approval: 'Awaiting approval',
  executing: 'Executing',
  completed: 'Completed',
  blocked: 'Blocked',
  failed: 'Failed',
};

export function StatusPill({ status }: { status: RunStatus }) {
  return <span className={`pill status-${status}`} style={{ whiteSpace: 'nowrap' }}>{labels[status]}</span>;
}
