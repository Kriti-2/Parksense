import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import KPICard from '../components/KPICard';
import HeatMap from '../components/HeatMap';
import CongestionDebt from '../components/CongestionDebt';
import ROICard from '../components/ROICard';
import EnforcementBrief from '../components/EnforcementBrief';
import SeverityQueue from '../components/SeverityQueue';
import RecidivismMap from '../components/RecidivismMap';
import TimeLapse from '../components/TimeLapse';
import WeatherBanner from '../components/WeatherBanner';

const SLIDES = [
  '/ChatGPT Image Jun 19, 2026, 08_53_06 PM.png',
  '/ChatGPT Image Jun 19, 2026, 08_53_15 PM.png',
  '/ChatGPT Image Jun 19, 2026, 08_53_22 PM.png',
];

// ── Small stat pill used in the hero strip ──────────────────────────────────
function StatPill({ icon, iconBg, value, label, sub }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-r border-gray-100 last:border-r-0 flex-1 min-w-0">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${iconBg}`}>
        <span className="text-base">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-[10px] text-gray-400 leading-tight">{label}</div>
        <div className="text-[10px] text-gray-300 leading-none">{sub}</div>
      </div>
    </div>
  );
}

// ── Hero section — image carousel + left overlay + bottom stats strip ───────
function HeroSection({ analytics, lastTick, connected }) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrentIndex((p) => (p + 1) % SLIDES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const kpis = analytics?.kpis || {};
  const violationsLastHour = lastTick?.kpis?.violations_last_hour ?? kpis.violations_last_hour ?? '—';
  const hotspots = kpis.active_hotspots ?? '—';
  const congestion = kpis.avg_congestion_score ? `${Math.round(kpis.avg_congestion_score)}%` : '—';

  return (
    <div className="-mx-4 md:-mx-6 mb-8">
      {/* ── Carousel image area ─────────────────────────────────────────── */}
      <div className="relative group w-full overflow-hidden h-[280px] sm:h-[350px] md:h-[420px]">

        {/* Background slides */}
        {SLIDES.map((slide, i) => (
          <div
            key={slide}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              src={slide}
              alt={`Slide ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              fetchPriority={i === 0 ? 'high' : 'low'}
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {/* Left-side dark gradient overlay — exactly like reference */}
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(10,12,18,0.92) 0%, rgba(10,12,18,0.75) 30%, rgba(10,12,18,0.35) 55%, transparent 72%)',
          }}
        />

        {/* ── Left text content ────────────────────────────────────────── */}
        <div className="absolute inset-0 z-30 flex flex-col justify-center px-6 sm:px-10 md:px-14" style={{ maxWidth: '520px' }}>
          {/* Label */}
          <div className="flex items-center gap-2 mb-2 sm:mb-4">
            <div className="h-px w-8 bg-[#BA5A5A]" />
            <span className="text-[#BA5A5A] text-xs font-bold tracking-widest uppercase">ParkSense</span>
          </div>

          {/* Headline */}
          <h1 className="text-white font-black leading-tight mb-2 sm:mb-3" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.6rem)', textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
            Making Bengaluru<br />
            Move Smarter.
          </h1>

          {/* Subtitle */}
          <p className="text-white/65 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-7 max-w-xs">
            Predict congestion. Detect violations. Optimize mobility.
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 bg-[#BA5A5A] hover:bg-[#A04848] text-white text-sm font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg shadow-lg transition-colors cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Live Feed
            </button>
            <button
              onClick={() => navigate('/predict')}
              className="flex items-center gap-2 border border-white/35 text-white text-sm font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Predict Violations
            </button>
          </div>
        </div>

        {/* Prev / Next arrows */}
        <button
          type="button"
          onClick={() => setCurrentIndex((p) => (p - 1 + SLIDES.length) % SLIDES.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/20 text-white opacity-0 group-hover:opacity-100 hover:bg-white/25 transition-all cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setCurrentIndex((p) => (p + 1) % SLIDES.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/20 text-white opacity-0 group-hover:opacity-100 hover:bg-white/25 transition-all cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Slide dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex gap-1.5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Stats strip — white card at the bottom ──────────────────────── */}
      <div className="mx-4 md:mx-6 bg-white rounded-b-2xl shadow-lg border border-gray-100 overflow-x-auto no-scrollbar">
        <div className="flex items-stretch min-w-max md:min-w-0">
          {/* LIVE indicator */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-r border-gray-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F9EDED] shrink-0">
              <span className="h-3 w-3 rounded-full bg-[#BA5A5A] animate-pulse block" />
            </div>
            <div>
              <div className="text-xs font-black text-[#BA5A5A] tracking-wider">LIVE</div>
              <div className="text-[10px] text-gray-400">Live Feed</div>
            </div>
          </div>

          <StatPill
            icon="🛡️"
            iconBg="bg-red-50"
            value={violationsLastHour}
            label="Violations"
            sub="Last Hour"
          />
          <StatPill
            icon="📍"
            iconBg="bg-orange-50"
            value={hotspots}
            label="High Risk"
            sub="Zones"
          />
          <StatPill
            icon="🎥"
            iconBg="bg-blue-50"
            value="4"
            label="CCTV"
            sub="Streams"
          />
          <StatPill
            icon="🔔"
            iconBg="bg-purple-50"
            value={analytics ? Object.keys(analytics?.violation_trends || {}).length || '12' : '—'}
            label="Active"
            sub="Alerts"
          />
          <StatPill
            icon="📈"
            iconBg="bg-[#F9EDED]"
            value={congestion}
            label="Congestion"
            sub="Risk"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Homepage component ─────────────────────────────────────────────────
export default function Homepage() {
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
      const activeCount = Object.values(payload.zone_intensity || {}).filter((z) => z.congestion_score >= 50).length;
      setActiveHotspotsHistory((prev) => [...prev.slice(-9), activeCount]);
      const intensities = Object.values(payload.zone_intensity);
      const avgScore =
        intensities.length > 0
          ? intensities.reduce((s, z) => s + z.congestion_score, 0) / intensities.length
          : 40;
      setAvgCongestionHistory((prev) => [...prev.slice(-9), Math.round(avgScore)]);
    }
    if (payload.corridors) setCorridors(payload.corridors);
    if (payload.severity_queue) {
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
      if (payload.kpis.violations_last_hour !== undefined) {
        setViolationsLastHourHistory((prev) => [...prev.slice(-9), payload.kpis.violations_last_hour]);
      }
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    async function load() {
      try {
        // Phase 1 — fast critical data, show UI immediately
        const [an, pr] = await Promise.all([api.getAnalytics(), api.getPredictions()]);
        setAnalytics(an.data);
        setPredictions(pr.data);
        setLoading(false);

        // Phase 2 — heavy data in background
        const [hm, se, re, sh, co] = await Promise.all([
          api.getHeatmap(800),
          api.getSeverityQueue(20),
          api.getRecidivism(),
          api.getShiftPlanner(),
          api.getCorridors(),
        ]);
        setHeatmap(hm.data);
        setSeverity(se.data);
        setRecidivism(re.data);
        setShiftData(sh.data);
        setCorridors(co.data);
      } catch (err) {
        setError(err.message || 'Failed to load data');
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <HeroSection analytics={null} lastTick={null} connected={false} />
        <div className="flex h-40 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#BA5A5A] border-t-transparent" />
            <p className="mt-3 text-xs text-gray-400">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center mt-4">
        <p className="text-red-500">{error}</p>
        <p className="mt-2 text-sm text-gray-400">Ensure the backend is running on port 8000</p>
      </div>
    );
  }

  const kpis = analytics?.kpis || {};

  return (
    <div className="animate-fadeIn">
      {/* ── Hero ── */}
      <HeroSection analytics={analytics} lastTick={lastTick} connected={connected} />

      {/* ── Dashboard section ── */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Overview</h2>
            <p className="mt-0.5 text-sm text-gray-400">Bengaluru parking congestion &amp; enforcement dashboard</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Last 1 Hour
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <WeatherBanner weatherData={predictions?.weather_escalation} liveWeather={lastTick?.weather} />

        {/* Tabs */}
        <div className="flex overflow-x-auto select-none no-scrollbar flex-nowrap bg-white border border-gray-100 p-1.5 rounded-xl w-full sm:w-fit gap-1.5 shadow-sm">
          {[
            { id: 'overview', label: '📊 Live Overview' },
            { id: 'economic', label: '💸 Economic Impact' },
            { id: 'operations', label: '🚨 Patrol Operations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#BA5A5A] text-white shadow-md font-bold'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
            <HeatMap data={heatmap} zoneIntensity={heatmap?.zone_intensity} className="h-[300px] sm:h-[400px] md:h-[450px]" />
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
    </div>
  );
}


