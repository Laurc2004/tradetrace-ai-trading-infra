import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { LangSwitcher } from '@/components/lang-switcher';
import './globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Common' });
  return {
    title: t('brand'),
    description: locale === 'zh'
      ? 'AI 交易智能体的飞行记录器：记录、回测、风险评分、审批、回放。'
      : 'A flight recorder for AI trading agents: parse, backtest, score risk, gate execution, replay.',
  };
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: 'Common' });

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <header className="topbar">
            <a className="brand" href={`/${locale}`}>{t('brand')}</a>
            <div className="topbar-right">
              <nav>
                <a href={`/${locale}/runs/new`}>{t('navNewRun')}</a>
                <a href={`/${locale}/dashboard`}>{t('navDashboard')}</a>
                <a href={`/${locale}/api/runs`}>{t('navApi')}</a>
              </nav>
              <LangSwitcher />
            </div>
          </header>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
