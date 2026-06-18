'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';

export function LangSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(target: 'zh' | 'en') {
    if (target === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: target });
    });
  }

  return (
    <div className="lang-switcher" aria-label="Language switcher">
      <a
        className={locale === 'zh' ? 'active' : ''}
        aria-current={locale === 'zh' ? 'true' : undefined}
        href="#"
        onClick={(event) => { event.preventDefault(); switchTo('zh'); }}
        role="button"
      >
        中
      </a>
      <a
        className={locale === 'en' ? 'active' : ''}
        aria-current={locale === 'en' ? 'true' : undefined}
        href="#"
        onClick={(event) => { event.preventDefault(); switchTo('en'); }}
        role="button"
      >
        EN
      </a>
      {isPending ? <span style={{ marginLeft: 6, color: 'var(--muted)' }}>...</span> : null}
    </div>
  );
}
