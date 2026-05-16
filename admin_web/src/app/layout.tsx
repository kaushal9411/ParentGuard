import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ParentGuard — Monitoring Dashboard',
  description: 'Real-time parental monitoring and child safety dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
