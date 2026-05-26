export function EmployeeAttendanceSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div>
        <div className="h-7 w-32 bg-gray-200 rounded shimmer mb-1.5" />
        <div className="h-4 w-52 bg-gray-100 rounded shimmer" />
      </div>

      {/* Clock In/Out Card Skeleton */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-100 shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded shimmer" />
            <div className="h-3 w-28 bg-gray-100 rounded shimmer" />
          </div>
        </div>
        <div className="h-12 w-full bg-primary-100 rounded-lg shimmer" />
      </div>

      {/* Today's Status Skeleton */}
      <div className="bg-white rounded-xl border border-border/60 shadow-sm p-5 space-y-3">
        <div className="h-5 w-28 bg-gray-200 rounded shimmer" />
        <div className="grid grid-cols-2 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 bg-gray-100 rounded shimmer" />
              <div className="h-5 w-20 bg-gray-200 rounded shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* History Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 bg-gray-200 rounded shimmer" />
          <div className="h-5 w-16 bg-gray-100 rounded shimmer" />
        </div>
        <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden divide-y divide-border/40">
          {[0,1,2,3,4,5].map(i => (
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
    </div>
  );
}
