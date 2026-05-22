import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ParentGuard — Keep Your Child Safe Online & Offline',
  description: 'India\'s most trusted parental monitoring app. Real-time GPS tracking, call & SMS monitoring, app usage analytics and remote device control for Indian families.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
