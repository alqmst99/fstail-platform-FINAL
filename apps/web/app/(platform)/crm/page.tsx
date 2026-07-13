import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Crm',
};

export default function CrmPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-surface-50">
        Crm
      </h1>
      <p className="mt-2 text-surface-400">
        {'TODO: implement in Phase ' + ('5' if route == 'audit' else '6' if route == 'radar' else '7' if route == 'crm' else '8')}
      </p>
    </div>
  );
}
