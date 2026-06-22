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
      // Scroll to the report section so the user sees where the report will land.
      // Wait one frame so the refreshed DOM (report placeholder) is mounted first.
      if (path === 'approve') {
        requestAnimationFrame(() => {
          document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    });
  }

  if (!enabled) return null;

  return (
    <div className="actions">
      <button disabled={isPending} onClick={() => act('approve')} type="button">
        {isPending ? 'Executing...' : 'Approve run'}
      </button>
      <button className="secondary" disabled={isPending} onClick={() => act('reject')} type="button">
        {isPending ? 'Rejecting...' : 'Reject run'}
      </button>
    </div>
  );
}
