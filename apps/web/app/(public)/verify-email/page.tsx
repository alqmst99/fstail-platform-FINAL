import { Suspense } from 'react';
import VerifyEmailClient from './VerifyEmailClient';

export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
