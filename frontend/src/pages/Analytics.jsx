import { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import CongestionDebt from '../components/CongestionDebt';
import TimeLapse from '../components/TimeLapse';
import LiveStatusBar from '../components/LiveStatusBar';
import { useAuth } from '../context/AuthContext';
import ROICard from '../components/ROICard';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const { isOfficer } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(null);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type !== 'live_tick') return;
    setLastTick(payload);
    if (payload.analytics) {
      setAnalytics(payload.analytics);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    async function load() {
      try {
        const [anRes, shRes] = await Promise.all([
          api.getAnalytics(),
          isOfficer ? api.getShiftPlanner() : Promise.resolve({ data: null })
        ]);
        setAnalytics(anRes.data);
        setShiftData(shRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load analytics data:", err);
        setLoading(false);
      }
    }
    load();
  }, [isOfficer]);

  if (loading) {
    return <div className="text-center text-gray-400">Loading live analytics...</div>;
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
  const scopeLabel = analytics?.zone_breakdown_scope === 'last_24h' ? 'Last 24 hours (live)' : 'All time';

  return (
    <div className="space-y-6 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Analytics & Economic Impact</h2>
          <p className="mt-1 text-xs text-gray-400 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
            Live congestion fingerprinting and economic loss from real Bengaluru violation data
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      {analytics?.data_sources && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-command-border bg-command-panel px-4 py-3 text-xs text-gray-400">
          <span>Violations: <strong className="text-gray-200">{analytics.data_sources.violations}</strong></span>
          <span>Traffic: <strong className="text-gray-200">{analytics.data_sources.traffic?.source || '—'}</strong></span>
          <span>Zone breakdown: <strong className="text-gray-200">{scopeLabel}</strong></span>
          {analytics.reference_time && (
            <span>Reference: <strong className="text-gray-200">{new Date(analytics.reference_time).toLocaleString()}</strong></span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <CongestionDebt analytics={analytics} />
          {isOfficer && <ROICard shiftData={shiftData} analytics={analytics} />}
        </div>
        <TimeLapse trends={analytics?.violation_trends} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="text-lg font-semibold text-white">Congestion Fingerprints</h3>
          <p className="text-sm text-command-muted">Live speed drop % by corridor</p>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={congestionData}>
                <XAxis dataKey="zone" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Bar dataKey="score" fill="#3b82f6" name="Congestion Score" radius={[4, 4, 0, 0]} />
                <Bar dataKey="speedDrop" fill="#ef4444" name="Speed Drop %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-command-border bg-command-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Violation Distribution</h3>
            <p className="text-sm text-command-muted">{scopeLabel}</p>
          </div>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...zoneBreakdown].sort((a, b) => b.violations - a.violations)}
                layout="vertical"
                margin={{ left: 10, right: 35, top: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  dataKey="zone"
                  type="category"
                  tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }}
                  width={90}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e5e7eb' }}
                  formatter={(value, name, props) => [
                    `${value.toLocaleString()} violations (${props.payload.share_pct}%)`,
                    'Count'
                  ]}
                />
                <Bar dataKey="violations" radius={[0, 4, 4, 0]} barSize={12}>
                  {zoneBreakdown.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                  <LabelList
                    dataKey="share_pct"
                    position="right"
                    formatter={(val) => `${val}%`}
                    style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-command-border bg-command-panel p-6">
        <h3 className="text-lg font-semibold text-white">Economic Loss Breakdown</h3>
        <p className="text-sm text-command-muted">Derived from live congestion + violation density</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={economicData}>
              <XAxis dataKey="zone" tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                itemStyle={{ color: '#e5e7eb' }}
              />
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
          <p className="text-sm text-command-muted">Updated from live rankings every 30s</p>
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
