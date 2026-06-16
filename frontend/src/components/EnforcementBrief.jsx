const severityStyles = {
  CRITICAL: 'bg-command-danger/20 text-command-danger border-command-danger/30',
  MEDIUM: 'bg-command-warning/20 text-command-warning border-command-warning/30',
  LOW: 'bg-command-accent/20 text-command-accent border-command-accent/30',
};

export default function EnforcementBrief({ shiftData, predictions }) {
  const assignments = shiftData?.assignments?.slice(0, 5) || [];
  const topPredictions = predictions?.top_risk_zones?.slice(0, 3) || [];

  return (
    <div className="rounded-xl border border-command-border bg-command-panel p-6">
      <h3 className="text-lg font-semibold text-white">Enforcement Brief</h3>
      <p className="mt-1 text-sm text-command-muted">Priority actions for next 24 hours</p>

      <div className="mt-4 space-y-3">
        {topPredictions.map((pred) => (
          <div key={pred.zone} className="rounded-lg border border-command-border bg-command-bg p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">{pred.zone}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${severityStyles.CRITICAL}`}>
                Risk {pred.risk_score}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {pred.predicted_violations} predicted violations · Peak {pred.peak_hour}:00
            </p>
            <p className="mt-1 text-xs text-gray-500">{pred.drivers?.join(' · ')}</p>
          </div>
        ))}
      </div>

      {assignments.length > 0 && (
        <div className="mt-5 border-t border-command-border pt-4">
          <p className="text-xs font-medium uppercase text-command-muted">Recommended Deployment</p>
          <div className="mt-2 space-y-2">
            {assignments.map((a) => (
              <div key={a.zone} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{a.zone}</span>
                <span className="font-medium text-white">
                  {a.officers_recommended} officers · {a.shift}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
