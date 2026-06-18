import { listRuns } from '@/lib/store';
import { StatusPill } from '@/components/status-pill';

export default async function HomePage() {
  const runs = (await listRuns()).slice(0, 3);

  return (
    <main>
      <section className="hero">
        <div>
          <div className="kicker">Bitget Hackathon Track 2 Infra</div>
          <h1>Flight recorder for AI trading agents.</h1>
          <p>
            TradeTrace records every strategy run as a replayable audit trail: what the user asked, how Qwen parsed it,
            how GetAgent tested it, what risks triggered, who approved it, and what happened next.
          </p>
          <div className="actions">
            <a className="button" href="/runs/new">Start a run</a>
            <a className="button secondary" href="/dashboard">View dashboard</a>
          </div>
        </div>
        <div className="panel flight-card">
          <div className="section-kicker">Final form</div>
          <h2>Web UI + Telegram bot</h2>
          <p>Web UI is the main demo surface. Telegram is the trigger and approval channel. Both share one run/event store.</p>
          <div className="grid" style={{ marginTop: 28 }}>
            <div><strong>01</strong><p>Run timeline</p></div>
            <div><strong>02</strong><p>Risk ledger</p></div>
            <div><strong>03</strong><p>Replay and report</p></div>
          </div>
        </div>
      </section>

      <section className="grid three">
        <div className="panel"><div className="section-kicker">Trace</div><h2>Every tool call is evidence.</h2><p>Capture parse, backtest, risk, approval, and execution events in one timeline.</p></div>
        <div className="panel"><div className="section-kicker">Govern</div><h2>Risk before execution.</h2><p>Deterministic rules block martingale, high leverage, missing stop loss, and weak backtests.</p></div>
        <div className="panel"><div className="section-kicker">Replay</div><h2>Demo survives API failure.</h2><p>Historical real runs can replay without live external APIs while staying auditable.</p></div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div className="run-list">
          {runs.map((bundle) => (
            <a className="panel run-row" href={`/runs/${bundle.run.run_id}`} key={bundle.run.run_id}>
              <div>
                <strong>{bundle.run.run_id}</strong>
                <p>{bundle.run.user_input}</p>
              </div>
              <StatusPill status={bundle.run.status} />
            </a>
          ))}
          {runs.length === 0 ? <p className="muted">Not available</p> : null}
        </div>
      </section>
    </main>
  );
}
