import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradeTrace',
  description: 'A flight recorder for AI trading agents: parse, backtest, score risk, gate execution, replay.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a className="brand" href="/">TradeTrace</a>
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
