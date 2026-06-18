'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Template = {
  id: string;
  label: string;
  description: string;
  strategy: string;
};

type ConsoleLine = {
  timestamp: string;
  actor: string;
  status: string;
  type: string;
  message: string;
  detail?: string;
};

const templates: Template[] = [
  {
    id: 'btc-momentum-guarded',
    label: 'BTC momentum + guardrails',
    description: 'Healthy demo path: trend confirmation, stop loss, take profit, position cap.',
    strategy: 'When BTC on 1h EMA20 crosses above EMA50 and RSI crosses from 45 to 55, go long. Use 1.5% stop loss, 4% take profit, max position 15%, pause after two consecutive losses.',
  },
  {
    id: 'danger-martingale',
    label: 'Danger: averaging down',
    description: 'Blocked demo path: leverage, martingale-like behavior, no clear stop.',
    strategy: 'Whenever price drops, keep adding to the position until it rebounds. Use high leverage and recover losses as fast as possible.',
  },
  {
    id: 'eth-breakout',
    label: 'ETH breakout',
    description: 'Review demo path: breakout, volume expansion, tight stop.',
    strategy: 'If ETH breaks above the previous 4h high with volume expansion, go long with 2% stop loss, 3% take profit, max position 10%.',
  },
];

export default function NewRunPage() {
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].id);
  const [strategy, setStrategy] = useState(templates[0].strategy);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const router = useRouter();

  const selected = useMemo(() => templates.find((item) => item.id === selectedTemplate) ?? templates[0], [selectedTemplate]);

  function chooseTemplate(template: Template) {
    setMode('template');
    setSelectedTemplate(template.id);
    setStrategy(template.strategy);
    setError(null);
    setConsoleLines([]);
    setRunId(null);
  }

  function useCustom() {
    setMode('custom');
    setStrategy('');
    setError(null);
    setConsoleLines([]);
    setRunId(null);
  }

  async function submit() {
    setError(null);
    setRunId(null);
    setConsoleLines([]);
    setIsRunning(true);

    try {
      const response = await fetch('/api/runs/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });

      if (!response.ok || !response.body) {
        const fallback = await response.json().catch(() => ({}));
        throw new Error(fallback?.error ?? 'Failed to create run. Check provider environment variables.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const payload = JSON.parse(line);
          if (payload.kind === 'progress') {
            setConsoleLines((existing) => [
              ...existing,
              {
                timestamp: payload.timestamp,
                actor: payload.actor,
                status: payload.status,
                type: payload.type,
                message: payload.message,
                detail: payload.detail,
              },
            ]);
            setRunId(payload.runId);
          }
          if (payload.kind === 'done') {
            setRunId(payload.runId);
            setConsoleLines((existing) => [
              ...existing,
              {
                timestamp: new Date().toISOString(),
                actor: 'system',
                status: 'completed',
                type: 'redirect.ready',
                message: 'Run complete. Flight recorder detail page is ready.',
              },
            ]);
          }
          if (payload.kind === 'error') {
            throw new Error(payload.error);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create run. Check provider environment variables.');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main>
      <div className="kicker">New Run</div>
      <h1>Start the recorder.</h1>
      <div className="grid two">
        <section className="panel">
          <h2>Natural-language strategy</h2>
          <div className="examples">
            {templates.map((template) => (
              <button className="example" key={template.id} onClick={() => chooseTemplate(template)} type="button">
                {template.label}
              </button>
            ))}
            <button className="example" onClick={useCustom} type="button">
              Fully custom
            </button>
          </div>
          {mode === 'template' ? <p>{selected.description}</p> : <p>Start from a blank strategy prompt.</p>}
          <textarea
            placeholder="Enter any natural-language trading strategy..."
            value={strategy}
            onChange={(event) => setStrategy(event.target.value)}
          />
          {error ? <p style={{ color: 'var(--red)' }}>{error}</p> : null}
          <div className="actions">
            <button onClick={submit} disabled={isRunning || !strategy.trim()} type="button">
              {isRunning ? 'Running recorder...' : 'Create run'}
            </button>
            {runId ? (
              <button className="secondary" onClick={() => router.push(`/runs/${runId}`)} type="button">
                Open detail page
              </button>
            ) : null}
          </div>
        </section>
        <section className="panel flight-card">
          <div className="section-kicker">What happens next</div>
          <h2>Watch AI and tools live.</h2>
          <p>When a run starts, the console below streams real Qwen, Evidence Pack, GetAgent, risk engine, approval, and report events.</p>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="section-kicker">Live tool-call console</div>
        {consoleLines.length === 0 ? (
          <p>Start a run to see live program and AI output here.</p>
        ) : (
          <div className="timeline">
            {consoleLines.map((line, index) => (
              <article className="event-card" key={`${line.timestamp}-${line.type}-${index}`}>
                <div className="event-dot" />
                <div className="event-content">
                  <div className="event-meta">
                    <span>{line.actor}</span>
                    <span>{line.status}</span>
                    <span>{line.type}</span>
                    <span>{new Date(line.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <h3>{line.message}</h3>
                  {line.detail ? <pre style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>{line.detail}</pre> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
