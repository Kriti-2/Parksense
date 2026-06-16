const severityStyles = {
  CRITICAL: 'bg-command-danger/20 text-command-danger',
  MEDIUM: 'bg-command-warning/20 text-command-warning',
  LOW: 'bg-command-accent/20 text-command-accent',
};

export default function SeverityQueue({ data }) {
  const queue = data?.queue?.slice(0, 8) || [];
  const summary = data?.summary || {};

  return (
    <div className="rounded-xl border border-command-border bg-command-panel p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Severity Queue</h3>
        <div className="flex gap-2 text-xs">
          {Object.entries(summary).map(([level, count]) => (
            <span key={level} className={`rounded-full px-2 py-0.5 font-medium ${severityStyles[level]}`}>
              {level}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {queue.map((item) => (
          <div
            key={item.violation_id}
            className="flex items-center justify-between rounded-lg border border-command-border bg-command-bg px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-white">{item.zone}</p>
              <p className="text-xs text-gray-500">
                {item.vehicle_type} · Score {item.severity_score}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityStyles[item.severity]}`}>
              {item.severity}
            </span>
          </div>
        ))}
        {!queue.length && <p className="text-sm text-gray-500">Loading severity queue...</p>}
      </div>
    </div>
  );
}
