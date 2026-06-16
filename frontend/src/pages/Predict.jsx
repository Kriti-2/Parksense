import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import HeatMap from '../components/HeatMap';
import ShiftPlanner from '../components/ShiftPlanner';

const RISK_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];

export default function Predict() {
  const [predictions, setPredictions] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [pr, sh, hm] = await Promise.all([
        api.getPredictions(),
        api.getShiftPlanner(),
        api.getHeatmap(800),
      ]);
      setPredictions(pr.data);
      setShiftData(sh.data);
      setHeatmap(hm.data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400">Loading predictions...</div>;
  }

  const zones = predictions?.top_risk_zones || [];
  const chartData = zones.map((z) => ({
    zone: z.zone.replace(' Layout', '').replace(' Board', ''),
    risk: z.risk_score,
    violations: z.predicted_violations,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">ParkPredict — 24h Forecast</h2>
        <p className="mt-1 text-sm text-command-muted">
          Top 10 high-risk zones powered by Prophet time-series forecasting
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="text-lg font-semibold text-white">Risk Rankings</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis dataKey="zone" type="category" width={90} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                />
                <Bar dataKey="risk" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-3">
          {zones.map((zone) => (
            <div
              key={zone.zone}
              className="flex items-center gap-4 rounded-xl border border-command-border bg-command-panel p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-command-accent/20 text-lg font-bold text-command-accent">
                #{zone.rank}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{zone.zone}</span>
                  <span className="text-sm font-bold text-command-danger">Risk {zone.risk_score}</span>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  {zone.predicted_violations} violations · Peak {zone.peak_hour}:00 ·{' '}
                  {(zone.confidence * 100).toFixed(0)}% confidence
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {zone.drivers?.map((d) => (
                    <span key={d} className="rounded bg-command-bg px-2 py-0.5 text-xs text-gray-400">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <HeatMap data={heatmap} zoneIntensity={heatmap?.zone_intensity} height="350px" />
      <ShiftPlanner data={shiftData} />
    </div>
  );
}
