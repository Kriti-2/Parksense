import { useEffect, useState } from 'react';

function formatINR(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function CongestionDebt({ analytics }) {
  const [displayValue, setDisplayValue] = useState(0);
  const dailyLoss = analytics?.kpis?.daily_economic_loss_inr || 0;
  const weeklyLoss = analytics?.kpis?.weekly_economic_loss_inr || 0;
  const monthlyLoss = analytics?.kpis?.monthly_economic_loss_inr || 0;

  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayValue(Math.floor(dailyLoss * progress));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [dailyLoss]);

  return (
    <div className="rounded-xl border border-command-danger/30 bg-gradient-to-br from-command-danger/10 to-command-panel p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-command-muted">
            Congestion Debt Counter
          </p>
          <p className="mt-2 text-4xl font-bold text-command-danger">{formatINR(displayValue)}</p>
          <p className="mt-1 text-sm text-gray-400">Daily economic loss from parking-induced congestion</p>
        </div>
        <div className="rounded-lg bg-command-danger/20 px-3 py-1 text-xs font-bold text-command-danger">
          LIVE
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-command-bg/50 p-3">
          <p className="text-xs text-command-muted">Weekly</p>
          <p className="text-lg font-semibold text-white">{formatINR(weeklyLoss)}</p>
        </div>
        <div className="rounded-lg bg-command-bg/50 p-3">
          <p className="text-xs text-command-muted">Monthly</p>
          <p className="text-lg font-semibold text-white">{formatINR(monthlyLoss)}</p>
        </div>
      </div>
      {analytics?.economic_losses && (
        <div className="mt-4 space-y-2">
          {analytics.economic_losses.slice(0, 4).map((zone) => (
            <div key={zone.zone} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{zone.zone}</span>
              <span className="font-medium text-white">{formatINR(zone.daily_loss)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
