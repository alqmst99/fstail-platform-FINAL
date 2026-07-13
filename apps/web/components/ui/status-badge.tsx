// apps/web/components/ui/status-badge.tsx
import { clsx } from 'clsx';

type Variant =
  | 'LEAD' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED'
  | 'DRAFT' | 'IN_PROGRESS' | 'DONE'
  | 'FREE' | 'PRO' | 'ENTERPRISE';

const STYLES: Record<Variant, string> = {
  // Client status
  LEAD:        'bg-blue-950 text-blue-400 border-blue-800',
  ACTIVE:      'bg-emerald-950 text-emerald-400 border-emerald-800',
  INACTIVE:    'bg-surface-800 text-surface-400 border-surface-700',
  ARCHIVED:    'bg-surface-900 text-surface-500 border-surface-700',
  // Project status
  COMPLETED:   'bg-emerald-950 text-emerald-400 border-emerald-800',
  ON_HOLD:     'bg-yellow-950 text-yellow-400 border-yellow-800',
  CANCELLED:   'bg-red-950 text-red-400 border-red-800',
  // Audit status
  DRAFT:       'bg-surface-800 text-surface-400 border-surface-700',
  IN_PROGRESS: 'bg-blue-950 text-blue-400 border-blue-800',
  DONE:        'bg-emerald-950 text-emerald-400 border-emerald-800',
  // Plan
  FREE:        'bg-surface-800 text-surface-400 border-surface-700',
  PRO:         'bg-gold-950 text-gold-400 border-gold-800',
  ENTERPRISE:  'bg-purple-950 text-purple-400 border-purple-800',
};

const LABELS: Partial<Record<Variant, string>> = {
  ON_HOLD: 'On Hold',
  IN_PROGRESS: 'In Progress',
};

interface StatusBadgeProps {
  status: Variant;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium',
        STYLES[status] ?? 'bg-surface-800 text-surface-400 border-surface-700',
        className,
      )}
    >
      {LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
