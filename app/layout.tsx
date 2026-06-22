import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradeTrace — Flight recorder for AI trading agents',
  description:
    'TradeTrace records every AI trading strategy run as a replayable audit trail: parse, local backtest, risk gating, human approval, and execution.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a className="brand" href="/">
            <span className="brand-dot" aria-hidden />
            TradeTrace
          </a>
          <div className="topbar-right">
            <nav>
              <a href="/runs/new">New Run</a>
              <a href="/dashboard">Dashboard</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
