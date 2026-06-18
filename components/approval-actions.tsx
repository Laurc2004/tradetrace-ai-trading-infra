'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ApprovalActions({ runId, enabled }: { runId: string; enabled: boolean }) {
  const t = useTranslations('ApprovalActions');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function act(path: 'approve' | 'reject') {
    startTransition(async () => {
      await fetch(`/api/runs/${runId}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: path === 'approve' ? t('approveReason') : t('rejectReason') }),
      });
      router.refresh();
    });
  }

  if (!enabled) return null;

  return (
    <div className="actions">
      <button disabled={isPending} onClick={() => act('approve')} type="button">{t('approve')}</button>
      <button className="secondary" disabled={isPending} onClick={() => act('reject')} type="button">{t('reject')}</button>
    </div>
  );
}
