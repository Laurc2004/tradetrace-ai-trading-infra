import { useTranslations } from 'next-intl';
import type { RunStatus } from '@/lib/types';

export function StatusPill({ status }: { status: RunStatus }) {
  const t = useTranslations('StatusPill');
  return <span className={`pill status-${status}`} style={{ whiteSpace: 'nowrap' }}>{t(status)}</span>;
}
