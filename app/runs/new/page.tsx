'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

const examples = [
  'When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long. Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive losses.',
  'Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible.',
  'If ETH breaks above the previous 4h high with volume expansion, go long with 2% stop loss, 3% take profit, max position 10%.',
];

export default function NewRunPage() {
  const [strategy, setStrategy] = useState(examples[0]);
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
        setError(bundle?.error ?? 'Failed to create run. Check provider environment variables.');
        return;
      }
      if (bundle?.run?.run_id) router.push(`/runs/${bundle.run.run_id}`);
    });
  }

  return (
    <main>
      <div className="kicker">New Run</div>
      <h1>Start the recorder.</h1>
      <div className="grid two">
        <section className="panel">
          <h2>Natural-language strategy</h2>
          <textarea value={strategy} onChange={(event) => setStrategy(event.target.value)} />
          <div className="examples">
            {examples.map((example, index) => (
              <button className="example" key={example} onClick={() => setStrategy(example)} type="button">
                Example {index + 1}
              </button>
            ))}
          </div>
          {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
          <button onClick={submit} disabled={isPending} type="button">
            {isPending ? 'Running recorder...' : 'Create run'}
          </button>
        </section>
        <section className="panel flight-card">
          <div className="section-kicker">What happens next</div>
          <h2>Parse, enrich, test, score, gate, replay.</h2>
          <p>TradeTrace uses the same provider-backed path locally and online: Qwen parse, Bitget Skill Evidence Pack, Playbook backtest, Risk Ledger, approval, replay, and report.</p>
        </section>
      </div>
    </main>
  );
}
