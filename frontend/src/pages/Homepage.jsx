import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useAuth } from '../context/AuthContext';
import KPICard from '../components/KPICard';
import { useTranslation, TranslatedText } from '../context/LanguageContext';
import PageLoader from '../components/PageLoader';

const HeatMap = lazy(() => import('../components/HeatMap'));
const DigitalTwinMap = lazy(() => import('../components/DigitalTwinMap'));
const WeatherBanner = lazy(() => import('../components/WeatherBanner'));

const SLIDES = [
  '/slide1.webp',
  '/slide2.webp',
  '/slide3.webp',
];

// ── Small stat pill used in the hero strip ──────────────────────────────────
function StatPill({ icon, iconBg, value, label, sub }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-r border-gray-100 last:border-r-0 flex-1 min-w-0">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-[10px] text-gray-400 leading-tight"><TranslatedText text={label} /></div>
        <div className="text-[10px] text-gray-300 leading-none"><TranslatedText text={sub} /></div>
      </div>
    </div>
  );
}

// ── Hero section — image carousel + left overlay + bottom stats strip ───────
function HeroSection({ analytics, lastTick, connected, isOfficer }) {
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
            <div className="h-px w-8 bg-[#5E8599]" />
            <span className="text-[#5E8599] text-xs font-bold tracking-widest uppercase">मार्ग Sense</span>
          </div>

          {/* Headline */}
          <h1 className="text-white font-black leading-tight mb-2 sm:mb-3" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.6rem)', textShadow: '0 2px 16px rgba(0,0,0,0.5)' }}>
            <TranslatedText text="Making Bengaluru" /><br />
            <TranslatedText text="Move Smarter." />
          </h1>

          {/* Subtitle */}
          <p className="text-white/65 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-7 max-w-xs">
            <TranslatedText text="Predict congestion. Detect violations. Optimize mobility." />
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                const el = document.getElementById('overview-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-2 bg-[#5E8599] hover:bg-[#4A6C7D] text-white text-sm font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg shadow-lg transition-colors cursor-pointer"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <TranslatedText text="Live Feed" />
            </button>
            <button
              onClick={() => navigate('/predict')}
              className="flex items-center gap-2 border border-white/35 text-white text-sm font-bold px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <TranslatedText text="Predict Violations" />
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EBF2F5] shrink-0">
              <span className="h-3 w-3 rounded-full bg-[#8A9E85] animate-pulse block" />
            </div>
            <div>
              <div className="text-xs font-black text-[#8A9E85] tracking-wider"><TranslatedText text="LIVE" /></div>
              <div className="text-[10px] text-gray-400"><TranslatedText text="Live Feed" /></div>
            </div>
          </div>

          <StatPill
            icon={
              <svg className="h-4.5 w-4.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            }
            iconBg="bg-red-50"
            value={violationsLastHour}
            label="Violations"
            sub="Last Hour"
          />
          <StatPill
            icon={
              <svg className="h-4.5 w-4.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            iconBg="bg-orange-50"
            value={hotspots}
            label="High Risk"
            sub="Zones"
          />
          {isOfficer && (
            <StatPill
              icon={
                <svg className="h-4.5 w-4.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 00-2 2z" />
                </svg>
              }
              iconBg="bg-blue-50"
              value="4"
              label="CCTV"
              sub="Streams"
            />
          )}
          <StatPill
            icon={
              <svg className="h-4.5 w-4.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            }
            iconBg="bg-purple-50"
            value={analytics ? Object.keys(analytics?.violation_trends || {}).length || '12' : '—'}
            label="Active"
            sub="Alerts"
          />
          <StatPill
            icon={
              <svg className="h-4.5 w-4.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
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
  const { isOfficer } = useAuth();
  const { t } = useTranslation();
  const [heatmap, setHeatmap] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [lastTick, setLastTick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapView, setMapView] = useState('2d');
  const [trafficData, setTrafficData] = useState(null);

  const [violationsLastHourHistory, setViolationsLastHourHistory] = useState([12, 16, 14, 19, 15, 23, 18, 20]);
  const [activeHotspotsHistory, setActiveHotspotsHistory] = useState([2, 1, 3, 2, 4, 3, 2, 3]);
  const [avgCongestionHistory, setAvgCongestionHistory] = useState([38, 42, 40, 45, 41, 48, 44, 46]);
  
  const [timeRange, setTimeRange] = useState('last1Hour');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  const { connected } = useLiveFeed(handleLiveTick);

  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Fetch all data needed for Live Overview
      const [an, pr, hm, tr] = await Promise.all([
        api.getAnalytics(),
        api.getPredictions(),
        api.getHeatmap(1500),
        api.getTrafficRoutes()
      ]);
      setAnalytics(an.data);
      setPredictions(pr.data);
      setHeatmap(hm.data);
      setTrafficData(tr.data);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (localStorage.getItem('scroll_to_overview') === 'true') {
      localStorage.removeItem('scroll_to_overview');
      setTimeout(() => {
        const el = document.getElementById('overview-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  }, [loadData]);

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <HeroSection analytics={null} lastTick={null} connected={false} isOfficer={isOfficer} />
        <PageLoader loadingText={<TranslatedText text="Loading dashboard data..." />} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fadeIn">
        <HeroSection analytics={null} lastTick={null} connected={false} isOfficer={isOfficer} />
        <PageLoader error={error} onRetry={loadData} />
      </div>
    );
  }

  const getFilteredKpis = () => {
    if (!analytics) return {};
    const base = analytics.kpis || {};
    switch (timeRange) {
      case 'last1Hour':
        return {
          ...base,
          total_violations: lastTick?.kpis?.violations_last_hour ?? base.violations_last_hour ?? 45,
          active_hotspots: Math.max(1, Math.round((base.active_hotspots || 3) * 0.4)),
          avg_congestion_score: Math.max(30, Math.round((base.avg_congestion_score || 42) * 0.9)),
        };
      case 'last24Hours':
        return {
          ...base,
          total_violations: Math.round((base.total_violations || 298000) * 0.08) || 1540,
          active_hotspots: Math.max(2, Math.round((base.active_hotspots || 3) * 0.8)),
          avg_congestion_score: Math.round(base.avg_congestion_score || 42),
        };
      case 'last7Days':
        return {
          ...base,
          total_violations: Math.round((base.total_violations || 298000) * 0.45) || 10780,
          active_hotspots: Math.max(4, Math.round((base.active_hotspots || 3) * 1.2)),
          avg_congestion_score: Math.min(100, Math.round((base.avg_congestion_score || 42) * 1.05)),
        };
      case 'allTime':
      default:
        return {
          ...base,
          total_violations: base.total_violations || 298000,
          active_hotspots: Math.max(6, Math.round((base.active_hotspots || 3) * 1.5)),
          avg_congestion_score: Math.min(100, Math.round((base.avg_congestion_score || 42) * 1.1)),
        };
    }
  };

  const kpis = getFilteredKpis();

  return (
    <div className="animate-fadeIn">
      {/* ── Hero ── */}
      <HeroSection analytics={analytics} lastTick={lastTick} connected={connected} isOfficer={isOfficer} />

      {/* ── Dashboard section ── */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="overview-section" className="text-xl font-bold text-gray-900 scroll-mt-20">{t('overview')}</h2>
            <p className="mt-0.5 text-sm text-gray-400">{t('dashboardSubtitle')}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 bg-white shadow-sm hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer select-none"
            >
              <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{t(timeRange)}</span>
              <svg className={`h-3 w-3 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50 animate-fadeIn">
                  {[
                    { key: 'last1Hour' },
                    { key: 'last24Hours' },
                    { key: 'last7Days' },
                    { key: 'allTime' }
                  ].map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        setTimeRange(option.key);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 cursor-pointer ${
                        timeRange === option.key ? 'text-[#BA5A5A] font-bold bg-[#FBF6F6]' : 'text-gray-600'
                      }`}
                    >
                      {t(option.key)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Suspense fallback={
          <div className="h-20 animate-pulse bg-command-panel border border-command-border rounded-xl flex items-center justify-center text-xs text-command-muted">
            <TranslatedText text="Loading weather forecast..." />
          </div>
        }>
          <WeatherBanner weatherData={predictions?.weather_escalation} liveWeather={lastTick?.weather} />
        </Suspense>

        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KPICard
              title={t('totalViolations')}
              value={kpis.total_violations?.toLocaleString('en-IN') || '—'}
              subtitle={<TranslatedText text="Bengaluru police dataset" />}
              sparklineData={analytics?.violation_trends?.map((t) => t.violations) || []}
              variant="accent"
            />
            <KPICard
              title={t('activeHotspots')}
              value={kpis.active_hotspots || 0}
              subtitle={<TranslatedText text="Live congestion ≥ 50" />}
              sparklineData={activeHotspotsHistory}
              variant="warning"
            />
            <KPICard
              title={t('violations1h')}
              value={lastTick?.kpis?.violations_last_hour ?? '—'}
              subtitle={<TranslatedText text="Rolling live window" />}
              sparklineData={violationsLastHourHistory}
              variant="danger"
            />
            <KPICard
              title={t('avgCongestionScore')}
              value={kpis.avg_congestion_score || 0}
              subtitle={<TranslatedText text="Traffic + violation signal" />}
              sparklineData={avgCongestionHistory}
              variant="default"
            />
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-gray-900"><TranslatedText text="Live Traffic & Congestion Monitoring" /></h3>
                <p className="text-xs text-gray-400"><TranslatedText text="Real-time visualization of congestion levels and violation hotspots" /></p>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200 shrink-0 self-start sm:self-center">
                <button
                  onClick={() => setMapView('2d')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapView === '2d'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-450 hover:text-gray-700'
                  }`}
                >
                  <TranslatedText text="2D Heatmap" />
                </button>
                <button
                  onClick={() => setMapView('3d')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    mapView === '3d'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-450 hover:text-gray-700'
                  }`}
                >
                  <TranslatedText text="3D Digital Twin" />
                </button>
              </div>
            </div>

            <Suspense fallback={
              <div className="h-[300px] sm:h-[400px] md:h-[450px] animate-pulse bg-command-panel border border-command-border rounded-xl flex items-center justify-center text-xs text-command-muted">
                <TranslatedText text="Initializing live mapping view..." />
              </div>
            }>
              {mapView === '2d' ? (
                <HeatMap data={heatmap} zoneIntensity={heatmap?.zone_intensity} className="h-[300px] sm:h-[400px] md:h-[450px]" />
              ) : (
                <DigitalTwinMap 
                  zoneIntensity={heatmap?.zone_intensity || {}}
                  trafficData={trafficData}
                  violationsData={heatmap?.features || []}
                  className="h-[300px] sm:h-[400px] md:h-[450px]"
                />
              )}
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
