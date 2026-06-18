'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ApprovalActions({ runId, enabled }: { runId: string; enabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function act(path: 'approve' | 'reject') {
    startTransition(async () => {
      await fetch(`/api/runs/${runId}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: path === 'approve' ? 'Approved from Web UI demo.' : 'Rejected from Web UI demo.' }),
      });
      router.refresh();
    });
  }

  if (!enabled) return null;

  return (
    <div className="actions">
      <button disabled={isPending} onClick={() => act('approve')} type="button">Approve run</button>
      <button className="secondary" disabled={isPending} onClick={() => act('reject')} type="button">Reject run</button>
    </div>
  );
}
