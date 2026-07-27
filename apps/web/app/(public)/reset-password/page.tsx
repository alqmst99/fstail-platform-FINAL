
// app/(public)/reset-password/page.tsx

import { Suspense } from 'react';
import ResetPasswordClient from '../reset-password/ResetPasswordClient';

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
