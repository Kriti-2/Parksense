import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../api/client';
import CongestionDebt from '../components/CongestionDebt';
import TimeLapse from '../components/TimeLapse';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAnalytics().then((res) => {
      setAnalytics(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400">Loading analytics...</div>;
  }

  const congestionData = analytics?.congestion_fingerprints?.map((c) => ({
    zone: c.corridor.replace(' Layout', ''),
    score: c.congestion_score,
    speedDrop: c.speed_drop_pct,
  })) || [];

  const economicData = analytics?.economic_losses?.map((e) => ({
    zone: e.zone.replace(' Layout', ''),
    daily: e.daily_loss,
    fuel: e.idle_fuel_cost,
    productivity: e.productivity_loss,
  })) || [];

  const zoneBreakdown = analytics?.zone_breakdown || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Analytics & Economic Impact</h2>
        <p className="mt-1 text-sm text-command-muted">
          Congestion fingerprinting, economic loss quantification, and policy recommendations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CongestionDebt analytics={analytics} />
        </div>
        <TimeLapse trends={analytics?.violation_trends} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="text-lg font-semibold text-white">Congestion Fingerprints</h3>
          <p className="text-sm text-command-muted">Speed drop % by corridor</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={congestionData}>
                <XAxis dataKey="zone" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="score" fill="#3b82f6" name="Congestion Score" radius={[4, 4, 0, 0]} />
                <Bar dataKey="speedDrop" fill="#ef4444" name="Speed Drop %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="text-lg font-semibold text-white">Violation Distribution</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={zoneBreakdown}
                  dataKey="violations"
                  nameKey="zone"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ zone, share_pct }) => `${zone} ${share_pct}%`}
                >
                  {zoneBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-command-border bg-command-panel p-6">
        <h3 className="text-lg font-semibold text-white">Economic Loss Breakdown</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={economicData}>
              <XAxis dataKey="zone" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Line type="monotone" dataKey="daily" stroke="#ef4444" strokeWidth={2} name="Daily Loss" />
              <Line type="monotone" dataKey="fuel" stroke="#f59e0b" strokeWidth={2} name="Fuel Cost" />
              <Line type="monotone" dataKey="productivity" stroke="#3b82f6" strokeWidth={2} name="Productivity" />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {analytics?.policy_recommendations && (
        <div className="rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="text-lg font-semibold text-white">Policy Recommendations</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {analytics.policy_recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-command-border bg-command-bg p-4">
                <span className="rounded bg-command-accent/20 px-2 py-0.5 text-xs font-bold text-command-accent">
                  {rec.priority}
                </span>
                <p className="mt-2 font-medium text-white">{rec.action}</p>
                <p className="mt-1 text-sm text-gray-400">{rec.zone}</p>
                <p className="mt-2 text-xs text-gray-500">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
