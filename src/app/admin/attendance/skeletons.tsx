'use client';

export function AttendanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Tabs Skeleton */}
      <div className="flex border-b border-border/50 gap-2 h-12">
        <div className="w-36 h-10 bg-slate-200/80 rounded-t" />
        <div className="w-32 h-10 bg-slate-100 rounded-t" />
        <div className="w-40 h-10 bg-slate-100 rounded-t" />
      </div>

      <div className="space-y-4">
        {/* Filters & Actions Skeleton */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            {/* Search filter input skeleton */}
            <div className="w-full sm:max-w-sm h-9 bg-slate-200 rounded-lg" />
            <div className="grid grid-cols-2 sm:flex gap-2 items-center">
              <div className="h-9 w-28 bg-slate-100 rounded-lg" />
              <div className="h-9 w-28 bg-slate-100 rounded-lg" />
              <div className="h-9 w-28 bg-slate-100 rounded-lg" />
              <div className="h-9 w-52 bg-slate-100 rounded-lg col-span-2 sm:col-span-1" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-16 bg-slate-200 rounded-lg" />
            <div className="h-9 w-32 bg-slate-200 rounded-lg" />
          </div>
        </div>

        {/* Sync status entry skeleton */}
        <div className="h-4 w-32 bg-slate-100 rounded px-1" />

        {/* Mobile skeleton cards (shown below md) */}
        <div className="block md:hidden space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-border/60 bg-white h-24 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-slate-100" />
                  <div className="h-3.5 w-24 bg-slate-200 rounded" />
                </div>
                <div className="h-4 w-12 bg-slate-200 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 w-16 bg-slate-100 rounded" />
                <div className="h-3 w-28 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table Skeleton (shown above md) */}
        <div className="hidden md:block bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-slate-50/50 h-10">
                  <th className="px-4 py-2.5 w-1/4"><div className="h-3 w-20 bg-slate-200 rounded" /></th>
                  <th className="px-4 py-2.5 w-1/8"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                  <th className="px-4 py-2.5 w-1/8"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                  <th className="px-4 py-2.5 w-1/8"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                  <th className="px-4 py-2.5 w-1/8"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                  <th className="px-4 py-2.5 w-1/8"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                  <th className="px-4 py-2.5 w-1/8"><div className="h-3 w-20 bg-slate-200 rounded" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx} className="h-12">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-slate-100" />
                        <div className="h-3 w-28 bg-slate-200 rounded" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-3 w-16 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-3.5 w-12 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-3.5 w-12 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-4 w-8 bg-slate-100 rounded" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-5 w-16 bg-slate-100 rounded-full" />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-5 w-16 bg-slate-100 rounded-full" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
