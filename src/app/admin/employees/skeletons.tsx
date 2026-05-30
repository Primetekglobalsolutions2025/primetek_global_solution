'use client';

export function EmployeesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 1. Stats Summary Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx} className="rounded-xl p-3 border border-border/50 shadow-sm flex items-center gap-3 bg-white h-14">
            <div className="w-8 h-8 rounded-lg bg-slate-200" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-12 bg-slate-200 rounded" />
              <div className="h-2 w-8 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* 2. Search & Actions Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="w-full sm:max-w-sm h-9 bg-slate-200 rounded-lg" />
        <div className="w-full sm:w-28 h-9 bg-slate-200 rounded-lg" />
      </div>

      {/* 3. Mobile Card Skeletons (hidden above md) */}
      <div className="block md:hidden space-y-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-border/60 bg-white space-y-3 h-36">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                  <div className="h-2.5 w-32 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-5 w-16 bg-slate-200 rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg h-10" />
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="flex gap-2">
                <div className="h-6 w-14 bg-slate-200 rounded" />
                <div className="h-6 w-14 bg-slate-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Desktop Table Skeleton (hidden below md) */}
      <div className="hidden md:block bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 h-10">
                <th className="px-4 py-2.5 w-2/5"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                <th className="px-4 py-2.5 w-1/5"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                <th className="px-4 py-2.5 w-1/5"><div className="h-3 w-16 bg-slate-200 rounded" /></th>
                <th className="px-4 py-2.5 w-1/10"><div className="h-3 w-12 bg-slate-200 rounded" /></th>
                <th className="px-4 py-2.5 w-1/10 text-right"><div className="h-3 w-12 bg-slate-200 rounded ml-auto" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="h-12">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-100" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3.5 w-28 bg-slate-200 rounded" />
                        <div className="h-2.5 w-40 bg-slate-100 rounded" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-3 w-20 bg-slate-100 rounded" />
                  </td>
                  <td className="px-4 py-2.5 font-bold uppercase tracking-wider">
                    <div className="h-3.5 w-16 bg-slate-100 rounded" />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-5 w-14 bg-slate-100 rounded-full" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      <div className="h-6 w-16 bg-slate-200 rounded" />
                      <div className="h-6 w-14 bg-slate-100 rounded" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
