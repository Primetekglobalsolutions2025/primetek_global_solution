import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="w-full h-[calc(100dvh-12rem)] md:h-[calc(100dvh-16rem)] min-h-[300px] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-navy-900/5 flex items-center justify-center border border-navy-900/10">
          <Loader2 className="w-6 h-6 text-navy-900 animate-spin" />
        </div>
        <div className="absolute -inset-1 rounded-2xl bg-navy-900/5 blur animate-pulse" />
      </div>
      <p className="text-text-muted text-xs font-bold uppercase tracking-widest text-navy-900/60">Loading Dashboard</p>
    </div>
  );
}
