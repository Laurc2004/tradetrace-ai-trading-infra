import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listRuns } from '@/lib/store';
import { StatusPill } from '@/components/status-pill';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('HomePage');
  const tCommon = await getTranslations('Common');
  const runs = (await listRuns()).slice(0, 3);

  return (
    <main>
      <section className="hero">
        <div>
          <div className="kicker">{t('kicker')}</div>
          <h1>{t('title')}</h1>
          <p>{t('lede')}</p>
          <div className="actions">
            <a className="button" href={`/${locale}/runs/new`}>{t('startRun')}</a>
            <a className="button secondary" href={`/${locale}/dashboard`}>{t('viewDashboard')}</a>
          </div>
        </div>
        <div className="panel flight-card">
          <div className="section-kicker">{t('finalFormKicker')}</div>
          <h2>{t('finalFormTitle')}</h2>
          <p>{t('finalFormBody')}</p>
          <div className="grid" style={{ marginTop: 28 }}>
            <div><strong>01</strong><p>{t('feature1Title')}</p></div>
            <div><strong>02</strong><p>{t('feature2Title')}</p></div>
            <div><strong>03</strong><p>{t('feature3Title')}</p></div>
          </div>
        </div>
      </section>

      <section className="grid three">
        <div className="panel"><div className="section-kicker">{t('traceKicker')}</div><h2>{t('traceTitle')}</h2><p>{t('traceBody')}</p></div>
        <div className="panel"><div className="section-kicker">{t('governKicker')}</div><h2>{t('governTitle')}</h2><p>{t('governBody')}</p></div>
        <div className="panel"><div className="section-kicker">{t('replayKicker')}</div><h2>{t('replayTitle')}</h2><p>{t('replayBody')}</p></div>
      </section>

      <section style={{ marginTop: 32 }}>
        <div className="run-list">
          {runs.map((bundle) => (
            <a className="panel run-row" href={`/${locale}/runs/${bundle.run.run_id}`} key={bundle.run.run_id}>
              <div>
                <strong>{bundle.run.run_id}</strong>
                <p>{bundle.run.user_input}</p>
              </div>
              <StatusPill status={bundle.run.status} />
            </a>
          ))}
          {runs.length === 0 ? <p className="muted">{tCommon('notAvailable')}</p> : null}
        </div>
      </section>
    </main>
  );
}
