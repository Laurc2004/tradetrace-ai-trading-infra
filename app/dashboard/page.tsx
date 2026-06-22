import { StatusPill } from '@/components/status-pill';
import { listRuns } from '@/lib/store';

export default async function DashboardPage() {
  const runs = await listRuns();
  const completed = runs.filter((bundle) => bundle.run.status === 'completed').length;
  const blocked = runs.filter((bundle) => bundle.run.status === 'blocked').length;
  const review = runs.filter((bundle) => bundle.run.status === 'awaiting_approval').length;
  const avgEvents = runs.length ? Math.round(runs.reduce((sum, bundle) => sum + bundle.events.length, 0) / runs.length) : 0;

  const stats = [
    { label: 'Total runs', value: runs.length },
    { label: 'Completed', value: completed },
    { label: 'Blocked', value: blocked },
    { label: 'Avg events/run', value: avgEvents },
  ];

  return (
    <main>
      <div className="kicker">Dashboard</div>
      <h1>AgentOps for trading runs.</h1>
      <p className="lead">Every run your recorder has captured, with its final status and risk outcome.</p>

      <section className="stat-grid" style={{ marginTop: 40 }}>
        {stats.map((s) => (
          <div className="panel metric" key={s.label}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </section>

      {review > 0 ? (
        <p style={{ marginTop: 28 }}>
          <span className="pill status-awaiting_approval" style={{ marginRight: 8 }}>{review} awaiting</span>
          {' '}
          run(s) are waiting for human approval.
        </p>
      ) : null}

      <section className="section-gap">
        <div className="kicker" style={{ marginBottom: 24, display: 'flex' }}>Recent runs</div>
        <div className="run-list">
          {runs.map((bundle) => (
            <a className="run-row" href={`/runs/${bundle.run.run_id}`} key={bundle.run.run_id}>
              <div>
                <strong>{bundle.run.run_id}</strong>
                <p>{bundle.run.user_input}</p>
              </div>
              <StatusPill status={bundle.run.status} />
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
