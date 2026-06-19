export default function LiveStatusBar({ connected, status, lastTick }) {
  const trafficSource = status?.traffic?.source || status?.data_sources?.traffic?.source || 'violation_density_model';
  const violationsLastHour = lastTick?.kpis?.violations_last_hour ?? '—';
  const bufferSize = lastTick?.kpis?.live_buffer_size ?? status?.buffer?.buffer_size ?? 0;

  const sourceLabels = {
    google_maps: 'Google Maps Traffic',
    tomtom: 'TomTom Live Traffic',
    violation_density_model: 'Bengaluru Violation Density',
    live_traffic_api: 'Live Traffic API',
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium tracking-wide">
      {/* Live Badge */}
      <span
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 shadow-sm transition-all duration-300 border backdrop-blur-md ${
          connected
            ? 'bg-sky-500/10 border-sky-500/25 text-sky-400 font-semibold'
            : 'bg-rose-500/10 border-rose-500/25 text-rose-400 font-semibold'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-rose-400'}`} />
        {connected ? 'LIVE' : 'RECONNECTING'}
      </span>

      {/* Traffic Info */}
      <span className="status-bar-pill flex items-center gap-1.5 rounded-full px-3 py-1 border shadow-sm backdrop-blur-md">
        <span className="status-bar-label">Traffic:</span>
        <span className="status-bar-value font-semibold">{sourceLabels[trafficSource] || trafficSource}</span>
      </span>

      {/* Violations Info */}
      <span className="status-bar-pill flex items-center gap-1.5 rounded-full px-3 py-1 border shadow-sm backdrop-blur-md">
        <span className="status-bar-label">Last hour:</span>
        <span className="status-bar-value font-semibold">{violationsLastHour} violations</span>
      </span>

      {/* Stream Info */}
      <span className="status-bar-pill flex items-center gap-1.5 rounded-full px-3 py-1 border shadow-sm backdrop-blur-md">
        <span className="status-bar-label">Stream:</span>
        <span className="status-bar-value font-semibold">{bufferSize} events</span>
      </span>
    </div>
  );
}

