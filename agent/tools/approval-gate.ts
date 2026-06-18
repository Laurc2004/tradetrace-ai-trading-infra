import { makeId, nowIso } from '@/lib/id';
import type { ApprovalRecord, RiskAssessment, SourceChannel } from '@/lib/types';

export function createInitialApproval(runId: string, risk: RiskAssessment, channel: SourceChannel): ApprovalRecord {
  if (risk.recommendation === 'Go') {
    return {
      approval_id: makeId('approval'),
      run_id: runId,
      required: false,
      decision: 'not_required',
      reviewer: 'system',
      reason: 'Low risk run can continue automatically.',
      channel,
      timestamp: nowIso(),
    };
  }

  if (risk.recommendation === 'Block') {
    return {
      approval_id: makeId('approval'),
      run_id: runId,
      required: true,
      decision: 'blocked',
      reviewer: 'risk_engine',
      reason: 'High risk run was blocked before execution.',
      channel,
      timestamp: nowIso(),
    };
  }

  return {
    approval_id: makeId('approval'),
    run_id: runId,
    required: true,
    decision: 'pending',
    reviewer: 'human_required',
    reason: 'Medium risk run requires human approval.',
    channel,
    timestamp: nowIso(),
  };
}

export function decideApproval(runId: string, decision: 'approved' | 'rejected', reason: string, reviewer: string, channel: SourceChannel): ApprovalRecord {
  return {
    approval_id: makeId('approval'),
    run_id: runId,
    required: true,
    decision,
    reviewer,
    reason: reason || (decision === 'approved' ? 'Approved by reviewer.' : 'Rejected by reviewer.'),
    channel,
    timestamp: nowIso(),
  };
}
