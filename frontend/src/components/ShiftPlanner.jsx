const priorityStyles = {
  CRITICAL: 'border-l-command-danger bg-command-danger/5',
  HIGH: 'border-l-command-warning bg-command-warning/5',
  MEDIUM: 'border-l-command-accent bg-command-accent/5',
  LOW: 'border-l-gray-600 bg-command-bg',
};

export default function ShiftPlanner({ data }) {
  const assignments = data?.assignments || [];
  const summary = data?.summary || {};

  return (
    <div className="rounded-xl border border-command-border bg-command-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Officer Deployment Recommendations</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-command-accent">{summary.total_officers_recommended || 0}</p>
          <p className="text-xs text-gray-500">Total officers</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-command-bg p-3">
          <p className="text-lg font-bold text-command-danger">{summary.critical_zones || 0}</p>
          <p className="text-xs text-gray-500">Critical</p>
        </div>
        <div className="rounded-lg bg-command-bg p-3">
          <p className="text-lg font-bold text-command-warning">{summary.high_priority_zones || 0}</p>
          <p className="text-xs text-gray-500">High</p>
        </div>
        <div className="rounded-lg bg-command-bg p-3">
          <p className="text-lg font-extrabold text-gray-900 dark:text-white">
            ₹{((summary.total_economic_impact_inr || 0) / 100000).toFixed(1)}L
          </p>
          <p className="text-xs text-gray-500">Impact</p>
        </div>
      </div>

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
        {assignments.map((item) => (
          <div
            key={item.zone}
            className={`rounded-lg border-l-4 border border-command-border p-4 ${priorityStyles[item.priority]}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-white">{item.zone}</span>
              <span className="text-xs font-bold uppercase text-gray-400">{item.priority}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-400">
              <span>{item.officers_recommended} officers</span>
              <span>{item.shift} shift</span>
              <span>{item.expected_violations} expected</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
