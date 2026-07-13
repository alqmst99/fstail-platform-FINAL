// apps/web/app/portal/layout.tsx
// Completely standalone layout for the public client portal.
// No auth check, no sidebar, no platform chrome.

import type { Metadata } from 'next';
import './print.css';

export const metadata: Metadata = {
  title: 'Client Report | FSTail Solutions',
  robots: 'noindex, nofollow',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
