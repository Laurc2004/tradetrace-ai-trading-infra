'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const examples = {
  zh: [
    '当 BTC 1h 周期 EMA20 上穿 EMA50、且 RSI 由 45 上穿到 55 时做多。止损 1.5%，止盈 4%，最大仓位 15%，连续亏损两次后暂停。',
    '只要价格下跌就不断加仓直到反弹。用高杠杆尽快把亏损赚回来。',
    '如果 ETH 向上突破前 4h 高点并伴随成交量放大，做多，止损 2%，止盈 3%，最大仓位 10%。',
  ],
  en: [
    'When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long. Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive losses.',
    'Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible.',
    'If ETH breaks above the previous 4h high with volume expansion, go long with 2% stop loss, 3% take profit, max position 10%.',
  ],
};

export default function NewRunPage() {
  const locale = useLocale();
  const t = useTranslations('NewRunPage');
  const items = locale === 'zh' ? examples.zh : examples.en;
  const [strategy, setStrategy] = useState(items[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      const bundle = await response.json();
      if (!response.ok) {
        setError(bundle?.error ?? t('errorGeneric'));
        return;
      }
      if (bundle?.run?.run_id) router.push(`/${locale}/runs/${bundle.run.run_id}`);
    });
  }

  return (
    <main>
      <div className="kicker">{t('kicker')}</div>
      <h1>{t('title')}</h1>
      <div className="grid two">
        <section className="panel">
          <h2>{t('strategyTitle')}</h2>
          <textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} />
          <div className="examples">
            {items.map((example, index) => (
              <button className="example" key={example} onClick={() => setStrategy(example)} type="button">
                {t('examplePrefix')} {index + 1}
              </button>
            ))}
          </div>
          {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
          <button onClick={submit} disabled={isPending} type="button">
            {isPending ? t('submitting') : t('submit')}
          </button>
        </section>
        <section className="panel flight-card">
          <div className="section-kicker">{t('nextKicker')}</div>
          <h2>{t('nextTitle')}</h2>
          <p>{t('nextBody')}</p>
        </section>
      </div>
    </main>
  );
}
