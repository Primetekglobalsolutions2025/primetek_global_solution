import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Standard status to theme mappings that satisfy WCAG AA contrast guidelines.
 */
const getStatusTheme = (status: string) => {
  const s = status?.toLowerCase() || '';

  // Green / Success: active, working, present, approved, active desktop
  if (['working', 'present', 'approved', 'approved wfh', 'desktop_active', 'desktop active'].includes(s)) {
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-600',
    };
  }

  // Yellow / Warning: idle, late, pending, pending wfh, break warning
  if (['idle', 'late', 'pending', 'pending wfh', 'idle_warning', 'idle warning'].includes(s)) {
    return {
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      dot: 'bg-amber-600',
    };
  }

  // Red / Error: absent, rejected, timer paused
  if (['absent', 'rejected', 'rejected wfh', 'productive_timer_paused', 'productive timer paused', 'timer paused'].includes(s)) {
    return {
      bg: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-600',
    };
  }

  // Orange / Heavy Warning: break (auto)
  if (['break (auto)', 'auto_break_triggered', 'auto break'].includes(s)) {
    return {
      bg: 'bg-orange-50 text-orange-700 border-orange-200',
      dot: 'bg-orange-600',
    };
  }

  // Blue / Info: break, lunch
  if (['break', 'lunch'].includes(s)) {
    return {
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      dot: 'bg-sky-600',
    };
  }

  // Purple / System Info: half-day
  if (['half-day', 'half_day', 'halfday'].includes(s)) {
    return {
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dot: 'bg-indigo-600',
    };
  }

  // Zinc / Neutral: logged out, force logged out, etc.
  if (['logged out', 'clocked_out', 'logged_out', 'force_logged_out', 'force_logout'].includes(s)) {
    return {
      bg: 'bg-zinc-50 text-zinc-700 border-zinc-200',
      dot: 'bg-zinc-500',
    };
  }

  // Default neutral fallback
  return {
    bg: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    dot: 'bg-zinc-400',
  };
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const theme = getStatusTheme(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold border uppercase tracking-wider transition-all select-none shrink-0',
        theme.bg,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5 shrink-0', theme.dot)} />
      {status}
    </span>
  );
}
