'use client';

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="bg-[#0c1424]/40 rounded-xl p-5 border border-navy-800/80 shadow-sm h-32 flex flex-col justify-between">
          <div className="w-10 h-10 rounded-lg bg-navy-900/60" />
          <div className="space-y-2">
            <div className="h-6 w-12 bg-navy-800/60 rounded" />
            <div className="h-3 w-20 bg-navy-900/40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
      {Array.from({ length: 2 }).map((_, idx) => (
        <div key={idx} className="bg-[#0c1424]/40 rounded-xl p-5 border border-navy-800/80 shadow-sm h-64 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-1/3 bg-navy-800/60 rounded" />
            <div className="h-3 w-1/4 bg-navy-900/40 rounded" />
          </div>
          <div className="h-36 bg-navy-950/40 rounded-lg flex items-end justify-between p-4 gap-2 border border-navy-900/40">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 bg-navy-800/60 rounded-t" style={{ height: `${(i % 3 + 1) * 20}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentInquiriesSkeleton() {
  return (
    <div className="bg-[#0c1424]/40 rounded-xl border border-navy-800/80 shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-navy-800/50 bg-navy-950/40 h-12 flex items-center justify-between">
        <div className="h-4 w-28 bg-navy-800/60 rounded" />
        <div className="h-3 w-16 bg-navy-900/40 rounded" />
      </div>
      <div className="divide-y divide-navy-800/50">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div key={idx} className="px-5 py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-navy-800/60 rounded" />
              <div className="h-3.5 w-16 bg-navy-900/40 rounded-full" />
            </div>
            <div className="h-3 w-full bg-navy-900/40 rounded" />
            <div className="h-2.5 w-24 bg-navy-900/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SystemStatusSkeleton() {
  return (
    <div className="bg-[#0c1424]/40 border border-navy-800/80 rounded-xl p-6 h-48 animate-pulse flex flex-col justify-between">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-navy-800/60 rounded" />
        <div className="h-3 w-40 bg-navy-900/40 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-20 bg-navy-800/60 rounded" />
            <div className="h-2.5 w-8 bg-navy-900/40 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
