export default function RootLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        {/* Animated spinner */}
        <div className="relative w-14 h-14">
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border-2 border-primary-500/20"
            aria-hidden="true"
          />
          {/* Spinning arc */}
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-400 animate-spin"
            aria-hidden="true"
          />
          {/* Inner glow */}
          <div
            className="absolute inset-2 rounded-full bg-primary-500/10 blur-sm animate-pulse"
            aria-hidden="true"
          />
        </div>

        {/* Brand text */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-400/70">
            Loading
          </p>
        </div>
      </div>
    </div>
  );
}
