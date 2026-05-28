export function EmployeeDashboardSkeleton() {
  return (
    <div className="space-y-6 pb-6 animate-pulse">
      {/* Hero Skeleton */}
      <div className="relative overflow-hidden rounded-xl bg-navy-900 p-6 md:p-8 text-white shadow-xl shadow-navy-900/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 w-40 h-7" />
            <div className="space-y-2">
              <div className="h-10 bg-white/10 rounded-lg w-64 shimmer" />
              <div className="h-5 bg-white/10 rounded-lg w-48 shimmer" />
              <div className="h-4 bg-white/5 rounded w-80 mt-3 shimmer" />
            </div>
            <div className="flex gap-3 pt-1">
              <div className="h-10 w-36 bg-white/15 rounded-lg shimmer" />
              <div className="h-10 w-32 bg-white/10 rounded-lg shimmer" />
            </div>
          </div>
          {/* Profile Card Skeleton */}
          <div className="bg-navy-900/50 backdrop-blur-2xl rounded-xl p-5 border border-white/10 w-full lg:w-[280px] shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-white/10 shimmer" />
              <div className="space-y-1">
                <div className="h-3 w-20 bg-white/10 rounded shimmer ml-auto" />
                <div className="h-4 w-16 bg-white/10 rounded shimmer ml-auto" />
              </div>
            </div>
            <div className="space-y-3">
              <div><div className="h-3 w-16 bg-white/5 rounded shimmer mb-1" /><div className="h-4 w-24 bg-white/10 rounded shimmer" /></div>
              <div><div className="h-3 w-16 bg-white/5 rounded shimmer mb-1" /><div className="h-4 w-16 bg-white/10 rounded shimmer" /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0,1,2,3].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 border border-border/60 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-gray-100 mb-4 shimmer" />
            <div className="h-7 w-12 bg-gray-100 rounded mb-1 shimmer" />
            <div className="h-3 w-20 bg-gray-50 rounded shimmer" />
          </div>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Log Skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-primary-500 rounded-full" />
              <div className="h-6 w-36 bg-gray-100 rounded shimmer" />
            </div>
            <div className="h-6 w-16 bg-primary-50 rounded-lg shimmer" />
          </div>
          <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden divide-y divide-border/40">
            {[0,1,2,3,4].map(i => (
              <div key={i} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0 shimmer" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-gray-100 rounded shimmer" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-gray-50 rounded shimmer" />
                    <div className="h-5 w-16 bg-gray-50 rounded shimmer" />
                  </div>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="h-4 w-10 bg-gray-100 rounded shimmer ml-auto" />
                  <div className="h-5 w-16 bg-gray-50 rounded-full shimmer ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
          <div className="rounded-xl p-6 border bg-gray-50 border-gray-200">
            <div className="w-10 h-10 rounded-lg bg-gray-200 mb-4 shimmer" />
            <div className="h-5 w-36 bg-gray-200 rounded mb-2 shimmer" />
            <div className="h-3 w-full bg-gray-100 rounded mb-1 shimmer" />
            <div className="h-3 w-3/4 bg-gray-100 rounded mb-5 shimmer" />
            <div className="h-10 w-full bg-gray-200 rounded-lg shimmer" />
          </div>
          <div className="rounded-xl bg-navy-900 p-6 shadow-md shadow-navy-900/20">
            <div className="w-10 h-10 rounded-lg bg-white/10 mb-4 shimmer" />
            <div className="h-5 w-32 bg-white/10 rounded mb-2 shimmer" />
            <div className="h-3 w-full bg-white/5 rounded mb-1 shimmer" />
            <div className="h-3 w-3/4 bg-white/5 rounded mb-5 shimmer" />
            <div className="h-10 w-full bg-primary-500/30 rounded-lg shimmer" />
          </div>
          <div className="rounded-xl bg-emerald-500/5 p-6 border border-emerald-500/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-200 shimmer" />
              <div className="h-3 w-28 bg-emerald-100 rounded shimmer" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-emerald-100 rounded shimmer" />
              <div className="h-3 w-2/3 bg-emerald-100 rounded shimmer" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
