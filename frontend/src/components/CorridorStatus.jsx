const statusStyles = {
  CLEAR: 'bg-command-success/20 text-command-success border-command-success/30',
  CAUTION: 'bg-command-warning/20 text-command-warning border-command-warning/30',
  DEGRADED: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  BLOCKED: 'bg-command-danger/20 text-command-danger border-command-danger/30',
};

const priorityStyles = {
  CRITICAL: 'text-command-danger',
  HIGH: 'text-command-warning',
  MEDIUM: 'text-command-accent',
};

export default function CorridorStatus({ data }) {
  const corridors = data?.corridors || [];
  const summary = data?.summary || {};

  return (
    <div className="rounded-xl border border-command-border bg-command-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Green Corridor Protector</h3>
          <p className="text-sm text-command-muted">Emergency route monitoring</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-command-success">{summary.clear || 0} Clear</span>
          <span className="text-command-warning">{summary.degraded || 0} Degraded</span>
          <span className="text-command-danger">{summary.blocked || 0} Blocked</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {corridors.map((corridor) => (
          <div
            key={corridor.id}
            className="rounded-lg border border-command-border bg-command-bg p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-white">{corridor.name}</p>
                <p className="mt-1 text-xs text-gray-500">{corridor.zones?.join(' → ')}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[corridor.status]}`}>
                {corridor.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Active violations: <strong className="text-white">{corridor.active_violations}</strong>
              </span>
              <span className={`font-medium ${priorityStyles[corridor.priority_level]}`}>
                {corridor.priority_level}
              </span>
            </div>
          </div>
        ))}
        {!corridors.length && <p className="text-sm text-gray-500">Loading corridor status...</p>}
      </div>
    </div>
  );
}
