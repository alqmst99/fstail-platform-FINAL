// apps/web/app/(platform)/settings/page.tsx
import { redirect } from 'next/navigation';

export default function SettingsRootPage() {
  redirect('/settings/account');
}
