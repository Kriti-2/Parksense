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
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
          connected
            ? 'bg-command-success/20 text-command-success'
            : 'bg-command-danger/20 text-command-danger'
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-command-success' : 'bg-command-danger'}`} />
        {connected ? 'LIVE' : 'RECONNECTING'}
      </span>
      <span className="text-gray-500">
        Traffic: <span className="text-gray-300">{sourceLabels[trafficSource] || trafficSource}</span>
      </span>
      <span className="text-gray-500">
        Last hour: <span className="text-gray-300">{violationsLastHour} violations</span>
      </span>
      <span className="text-gray-500">
        Stream: <span className="text-gray-300">{bufferSize} events</span>
      </span>
    </div>
  );
}
