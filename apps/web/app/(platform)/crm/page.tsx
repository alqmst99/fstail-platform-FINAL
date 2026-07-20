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
        {`TODO: implement in Phase ${route === 'audit' ? '5' : route === 'radar' ? '6' : route === 'crm' ? '7' : '8'}`}
      </p>
    </div>
  );
}
