'use client';

export function DailyReportsSkeleton() {
  return (
    <div className="space-y-6 pb-12 animate-pulse">
      {/* Header Panel Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-sm h-24">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-slate-200 rounded" />
          <div className="h-3.5 w-64 bg-slate-100 rounded" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>

      {/* Main split */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-6">
          {/* Filters Card Skeleton */}
          <div className="p-4 rounded-2xl border border-border/80 bg-white h-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="h-10 bg-slate-100 rounded-xl" />
            <div className="h-10 bg-slate-100 rounded-xl" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>

          {/* Table Placeholder */}
          <div className="bg-white rounded-2xl border border-border shadow-sm h-96 p-4">
            <div className="h-10 bg-slate-200 rounded-xl mb-4" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-xl mb-3 flex items-center justify-between px-4">
                <div className="h-4 w-1/4 bg-slate-100 rounded" />
                <div className="h-4 w-1/3 bg-slate-100 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Status Tracker Skeleton */}
        <div className="xl:col-span-1 bg-white rounded-2xl border border-border shadow-sm h-96 overflow-hidden">
          <div className="h-12 bg-slate-100 border-b border-border flex items-center justify-between px-4">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-5 w-10 bg-slate-100 rounded-full" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-50 rounded-lg flex items-center justify-between px-3">
                <div className="h-3.5 w-20 bg-slate-100 rounded" />
                <div className="h-5 w-12 bg-slate-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
