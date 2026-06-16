import { useEffect, useState } from 'react';
import { api } from '../api/client';
import KPICard from '../components/KPICard';
import HeatMap from '../components/HeatMap';
import CongestionDebt from '../components/CongestionDebt';
import EnforcementBrief from '../components/EnforcementBrief';
import SeverityQueue from '../components/SeverityQueue';
import RecidivismMap from '../components/RecidivismMap';
import TimeLapse from '../components/TimeLapse';

function formatINR(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount?.toLocaleString('en-IN') || 0}`;
}

export default function Dashboard() {
  const [heatmap, setHeatmap] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [recidivism, setRecidivism] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [hm, an, pr, se, re, sh] = await Promise.all([
          api.getHeatmap(1500),
          api.getAnalytics(),
          api.getPredictions(),
          api.getSeverityQueue(30),
          api.getRecidivism(),
          api.getShiftPlanner(),
        ]);
        setHeatmap(hm.data);
        setAnalytics(an.data);
        setPredictions(pr.data);
        setSeverity(se.data);
        setRecidivism(re.data);
        setShiftData(sh.data);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-command-accent border-t-transparent" />
          <p className="mt-4 text-sm text-gray-400">Loading Bengaluru intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-command-danger/30 bg-command-danger/10 p-6 text-center">
        <p className="text-command-danger">{error}</p>
        <p className="mt-2 text-sm text-gray-400">Ensure the backend is running on port 8000</p>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Command Center Dashboard</h2>
        <p className="mt-1 text-sm text-command-muted">
          Real-time parking congestion intelligence across Bengaluru corridors
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Total Violations"
          value={kpis.total_violations?.toLocaleString('en-IN') || '—'}
          subtitle="Jan–May dataset"
          variant="accent"
        />
        <KPICard
          title="Active Hotspots"
          value={kpis.active_hotspots || 0}
          subtitle="Congestion score ≥ 50"
          variant="warning"
        />
        <KPICard
          title="Daily Economic Loss"
          value={formatINR(kpis.daily_economic_loss_inr)}
          subtitle="Fuel + productivity"
          variant="danger"
        />
        <KPICard
          title="Avg Congestion Score"
          value={kpis.avg_congestion_score || 0}
          subtitle="Across 6 corridors"
          variant="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <HeatMap data={heatmap} zoneIntensity={heatmap?.zone_intensity} height="420px" />
        </div>
        <CongestionDebt analytics={analytics} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <EnforcementBrief shiftData={shiftData} predictions={predictions} />
        <SeverityQueue data={severity} />
        <TimeLapse trends={analytics?.violation_trends} />
      </div>

      <RecidivismMap data={recidivism} />
    </div>
  );
}
