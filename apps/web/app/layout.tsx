import type { Metadata } from 'next';
// @ts-ignore
import './globals.css';
import { AuthProvider } from '@/lib/use-auth';   // ← importante este path

export const metadata: Metadata = {
  title: 'FSTail Solutions',
  description: 'Professional web development solutions — CRM, Audit, Radar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}