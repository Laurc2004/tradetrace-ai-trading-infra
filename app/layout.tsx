import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradeTrace Flight Recorder',
  description: 'A flight recorder for AI trading agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a className="brand" href="/">TradeTrace</a>
          <nav>
            <a href="/runs/new">New Run</a>
            <a href="/dashboard">Dashboard</a>
            <a href="/api/runs">API</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
