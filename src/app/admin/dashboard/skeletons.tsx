'use client';

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-3 animate-pulse">
      {Array.from({ length: 9 }).map((_, idx) => (
        <div key={idx} className="bg-white rounded-xl p-3.5 lg:p-4 border border-zinc-200 shadow-sm flex flex-col items-center gap-2.5 h-24">
          <div className="w-8 h-8 rounded-lg bg-zinc-200" />
          <div className="space-y-1.5 flex flex-col items-center">
            <div className="h-5 w-8 bg-zinc-200 rounded" />
            <div className="h-2 w-14 bg-zinc-100 rounded" />
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
        <div key={idx} className="bg-white rounded-xl p-5 border border-zinc-250 shadow-sm h-64 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-4 w-1/3 bg-zinc-200 rounded" />
            <div className="h-3 w-1/4 bg-zinc-100 rounded" />
          </div>
          <div className="h-36 bg-zinc-50 rounded-lg flex items-end justify-between p-4 gap-2 border border-zinc-200">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 bg-zinc-200 rounded-t" style={{ height: `${(i % 3 + 1) * 20}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-zinc-200 rounded-full" />
          <div className="h-4 w-28 bg-zinc-200 rounded" />
        </div>
        <div className="h-3 w-14 bg-zinc-100 rounded" />
      </div>
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden divide-y divide-zinc-100/60">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="px-4 py-3 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-zinc-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 bg-zinc-200 rounded" />
            </div>
            <div className="h-2.5 w-10 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SystemStatusSkeleton() {
  return (
    <div className="bg-white border border-zinc-250 rounded-xl p-6 h-52 animate-pulse flex flex-col justify-between">
      <div className="space-y-2">
        <div className="h-4 w-28 bg-zinc-200 rounded" />
        <div className="h-3 w-44 bg-zinc-100 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-24 bg-zinc-200 rounded" />
            <div className="h-2.5 w-8 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
