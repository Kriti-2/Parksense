import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useAudioAlerts } from '../hooks/useAudioAlerts';
import KPICard from '../components/KPICard';
import HeatMap from '../components/HeatMap';
import CongestionDebt from '../components/CongestionDebt';
import ROICard from '../components/ROICard';
import EnforcementBrief from '../components/EnforcementBrief';
import SeverityQueue from '../components/SeverityQueue';
import RecidivismMap from '../components/RecidivismMap';
import TimeLapse from '../components/TimeLapse';
import LiveStatusBar from '../components/LiveStatusBar';
import WeatherBanner from '../components/WeatherBanner';
import AudioAlertControls from '../components/AudioAlertControls';

function formatINR(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount?.toLocaleString('en-IN') || 0}`;
}

export default function Dashboard() {
  const audioHook = useAudioAlerts();
  // Stable ref to play() — lets handleLiveTick keep [] deps without stale closures
  const playRef = useRef(audioHook.play);
  useEffect(() => { playRef.current = audioHook.play; }, [audioHook.play]);
  const lastAlertTypeRef = useRef(null);

  const [heatmap, setHeatmap] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [recidivism, setRecidivism] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [corridors, setCorridors] = useState(null);
  const [lastTick, setLastTick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Sparkline history state arrays for live updates
  const [violationsLastHourHistory, setViolationsLastHourHistory] = useState([12, 16, 14, 19, 15, 23, 18, 20]);
  const [activeHotspotsHistory, setActiveHotspotsHistory] = useState([2, 1, 3, 2, 4, 3, 2, 3]);
  const [avgCongestionHistory, setAvgCongestionHistory] = useState([38, 42, 40, 45, 41, 48, 44, 46]);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type !== 'live_tick') return;
    setLastTick(payload);

    if (payload.zone_intensity) {
      setHeatmap((prev) =>
        prev ? { ...prev, zone_intensity: payload.zone_intensity, generated_at: payload.timestamp } : prev
      );

      // Update active hotspots history
      const activeCount = Object.values(payload.zone_intensity || {}).filter(
        (z) => z.congestion_score >= 50
      ).length;
      setActiveHotspotsHistory((prev) => [...prev.slice(-9), activeCount]);

      // Update avg congestion history
      const intensities = Object.values(payload.zone_intensity);
      const avgScore = intensities.length > 0
        ? intensities.reduce((s, z) => s + z.congestion_score, 0) / intensities.length
        : 40;
      setAvgCongestionHistory((prev) => [...prev.slice(-9), Math.round(avgScore)]);

      // 🔊 Audio alerts based on congestion thresholds
      const maxScore = intensities.length > 0
        ? Math.max(...intensities.map((z) => z.congestion_score))
        : 0;
      if (maxScore >= 80) {
        lastAlertTypeRef.current = 'critical';
        playRef.current('critical');
      } else if (activeCount >= 3) {
        lastAlertTypeRef.current = 'warning';
        playRef.current('warning');
      } else {
        lastAlertTypeRef.current = 'info';
        playRef.current('info');
      }
    }
    if (payload.corridors) {
      setCorridors(payload.corridors);
    }
    if (payload.severity_queue) {
      // 🔊 Fire critical alert if a CRITICAL violation appears
      const hasCritical = (payload.severity_queue || []).some((q) => q.severity === 'CRITICAL');
      if (hasCritical) {
        lastAlertTypeRef.current = 'critical';
        playRef.current('critical');
      }
      setSeverity((prev) => ({
        ...(prev || {}),
        queue: payload.severity_queue,
        summary: payload.severity_summary,
        generated_at: payload.timestamp,
      }));
    }
    if (payload.kpis) {
      setAnalytics((prev) =>
        prev
          ? {
              ...prev,
              kpis: {
                ...prev.kpis,
                active_hotspots: Object.values(payload.zone_intensity || {}).filter(
                  (z) => z.congestion_score >= 50
                ).length,
              },
            }
          : prev
      );

      // Update last hour violations history
      if (payload.kpis.violations_last_hour !== undefined) {
        setViolationsLastHourHistory((prev) => [...prev.slice(-9), payload.kpis.violations_last_hour]);
      }
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    async function load() {
      try {
        const [hm, an, pr, se, re, sh, co] = await Promise.all([
          api.getHeatmap(1500),
          api.getAnalytics(),
          api.getPredictions(),
          api.getSeverityQueue(30),
          api.getRecidivism(),
          api.getShiftPlanner(),
          api.getCorridors(),
        ]);
        setHeatmap(hm.data);
        setAnalytics(an.data);
        setPredictions(pr.data);
        setSeverity(se.data);
        setRecidivism(re.data);
        setShiftData(sh.data);
        setCorridors(co.data);
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
          <p className="mt-4 text-sm text-gray-400">Loading Bengaluru live intelligence...</p>
          <p className="mt-1 text-xs text-gray-500">Warming caches from 298K violation records</p>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Command Center Dashboard</h2>
          <p className="mt-1 text-sm text-command-muted">
            Live Bengaluru parking congestion — real violations + traffic intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AudioAlertControls audioHook={audioHook} lastAlertRef={lastAlertTypeRef} />
          <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
        </div>
      </div>

      <WeatherBanner
        weatherData={predictions?.weather_escalation}
        liveWeather={lastTick?.weather}
      />

      {/* Tabs Selector */}
      <div className="flex bg-command-panel border border-command-border p-1 rounded-xl w-fit gap-1 shadow-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-command-accent text-white shadow-sm'
              : 'text-command-muted hover:text-white'
          }`}
        >
          📊 Live Overview
        </button>
        <button
          onClick={() => setActiveTab('economic')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'economic'
              ? 'bg-command-accent text-white shadow-sm'
              : 'text-command-muted hover:text-white'
          }`}
        >
          💸 Economic Impact
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'operations'
              ? 'bg-command-accent text-white shadow-sm'
              : 'text-command-muted hover:text-white'
          }`}
        >
          🚨 Patrol Operations
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title="Total Violations"
              value={kpis.total_violations?.toLocaleString('en-IN') || '—'}
              subtitle="Bengaluru police dataset"
              sparklineData={analytics?.violation_trends?.map((t) => t.violations) || []}
              variant="accent"
            />
            <KPICard
              title="Active Hotspots"
              value={kpis.active_hotspots || 0}
              subtitle="Live congestion ≥ 50"
              sparklineData={activeHotspotsHistory}
              variant="warning"
            />
            <KPICard
              title="Violations (1h)"
              value={lastTick?.kpis?.violations_last_hour ?? '—'}
              subtitle="Rolling live window"
              sparklineData={violationsLastHourHistory}
              variant="danger"
            />
            <KPICard
              title="Avg Congestion Score"
              value={kpis.avg_congestion_score || 0}
              subtitle="Traffic + violation signal"
              sparklineData={avgCongestionHistory}
              variant="default"
            />
          </div>
          <div className="grid grid-cols-1 gap-6">
            <HeatMap data={heatmap} zoneIntensity={heatmap?.zone_intensity} height="420px" />
          </div>
        </div>
      )}

      {activeTab === 'economic' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fadeIn">
          <CongestionDebt analytics={analytics} />
          <ROICard shiftData={shiftData} analytics={analytics} />
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <EnforcementBrief shiftData={shiftData} predictions={predictions} corridors={corridors} />
            <SeverityQueue data={severity} />
            <TimeLapse trends={analytics?.violation_trends} />
          </div>
          <RecidivismMap data={recidivism} />
        </div>
      )}
    </div>
  );
}
