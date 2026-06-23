import { useCallback, useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
const HeatMap = lazy(() => import('../components/HeatMap'));
const DigitalTwinMap = lazy(() => import('../components/DigitalTwinMap'));
import ShiftPlanner from '../components/ShiftPlanner';

const RISK_COLORS = [
  '#BA5A5A', // Rank 1: Deep red
  '#C27A7A', // Rank 2: Red
  '#E67E22', // Rank 3: Dark orange
  '#F39C12', // Rank 4: Orange
  '#F1C40F', // Rank 5: Amber
  '#F5D13F', // Rank 6: Golden yellow
  '#F9E79F', // Rank 7: Light yellow
  '#FCE8A2', // Rank 8: Cream yellow
  '#FDF2C8', // Rank 9: Pale yellow
  '#FEF9E7', // Rank 10: Cream
];

// Helper functions for peak sparkline generation
const generateSparklinePath = (peakHour) => {
  const points = [];
  const width = 80;
  const height = 24;
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * width;
    // Bell curve equation peaking at the center (index 4)
    const dist = Math.abs(i - 4);
    const factor = Math.exp(-0.5 * Math.pow(dist / 1.8, 2));
    const y = height - (3 + factor * (height - 6));
    points.push(`${x},${y}`);
  }
  return `M ${points.join(' L ')}`;
};

const generateSparklineAreaPath = (peakHour) => {
  return generateSparklinePath(peakHour);
};

const formatTime = (h) => {
  if (h === 0) return '12:00 AM';
  if (h === 12) return '12:00 PM';
  if (h > 12) return `${h - 12}:00 PM`;
  return `${h}:00 AM`;
};

export default function Predict() {
  const [predictions, setPredictions] = useState(null);
  const [shortTermPredictions, setShortTermPredictions] = useState(null);
  const [activeTab, setActiveTab] = useState('24h');
  const [shiftData, setShiftData] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAllZones, setShowAllZones] = useState(false);
  const [rankingMetric, setRankingMetric] = useState('risk');
  const [mapView, setMapView] = useState('2d');
  const [trafficData, setTrafficData] = useState(null);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedHour((h) => (h + 1) % 24);
    }, 1500);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type !== 'live_tick') return;
    setLastTick(payload);

    if (payload.zone_intensity) {
      setHeatmap((prev) =>
        prev ? { ...prev, zone_intensity: payload.zone_intensity, generated_at: payload.timestamp } : prev
      );
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    async function load() {
      const [pr, sh, hm, st, tr] = await Promise.all([
        api.getPredictions(),
        api.getShiftPlanner(),
        api.getHeatmap(5000),
        api.getShortTermPredictions(),
        api.getTrafficRoutes(),
      ]);
      setPredictions(pr.data);
      setShiftData(sh.data);
      setHeatmap(hm.data);
      setShortTermPredictions(st.data);
      setTrafficData(tr.data);
      setLoading(false);
    }
    load();
  }, []);

  const zones = predictions?.top_risk_zones || [];

  const simulatedZones = useMemo(() => {
    return zones.map((z) => {
      const dist = Math.abs(selectedHour - z.peak_hour);
      const wrapDist = Math.min(dist, 24 - dist);
      const factor = Math.exp(-0.5 * Math.pow(wrapDist / 2.8, 2));
      const simulatedViolations = Math.max(1, Math.round(z.predicted_violations * (0.25 + 0.75 * factor)));
      const simulatedRisk = Math.max(10, Math.round(z.risk_score * (0.35 + 0.65 * factor)));
      return {
        ...z,
        simulatedViolations,
        simulatedRisk,
      };
    }).sort((a, b) => b.simulatedRisk - a.simulatedRisk).map((z, i) => ({
      ...z,
      simulatedRank: i + 1,
    }));
  }, [zones, selectedHour]);

  const chartData = useMemo(() => {
    const data = simulatedZones.map((z) => ({
      zone: z.zone.replace(' Layout', '').replace(' Board', ''),
      risk: z.simulatedRisk,
      violations: z.simulatedViolations,
      rank: z.simulatedRank,
    }));
    if (rankingMetric === 'violations') {
      return [...data].sort((a, b) => b.violations - a.violations);
    }
    return data;
  }, [simulatedZones, rankingMetric]);

  const simulatedZoneIntensity = useMemo(() => {
    if (!heatmap?.zone_intensity) return {};
    const intensity = {};
    Object.entries(heatmap.zone_intensity).forEach(([zone, meta]) => {
      const pred = zones.find((z) => z.zone === zone);
      if (pred) {
        const dist = Math.abs(selectedHour - pred.peak_hour);
        const wrapDist = Math.min(dist, 24 - dist);
        const factor = Math.exp(-0.5 * Math.pow(wrapDist / 2.8, 2));
        const score = Math.max(15, Math.round(meta.congestion_score * (0.3 + 0.7 * factor)));
        intensity[zone] = {
          ...meta,
          congestion_score: score,
          level: score >= 70 ? 'AVOID' : score >= 40 ? 'CAUTION' : 'CLEAR',
        };
      } else {
        intensity[zone] = meta;
      }
    });
    return intensity;
  }, [heatmap?.zone_intensity, zones, selectedHour]);

  const shortTermChartData = useMemo(() => {
    if (!shortTermPredictions?.predictions) return [];
    return shortTermPredictions.predictions.map((p) => ({
      zone: p.zone.replace(' Layout', '').replace(' Board', ''),
      predicted_15m: p.predicted_15m,
      predicted_30m: p.predicted_30m,
    })).sort((a, b) => b.predicted_30m - a.predicted_30m);
  }, [shortTermPredictions]);

  const sortedShortTerm = useMemo(() => {
    if (!shortTermPredictions?.predictions) return [];
    return [...shortTermPredictions.predictions].sort((a, b) => b.predicted_30m - a.predicted_30m);
  }, [shortTermPredictions]);

  if (loading) {
    return <div className="text-center text-gray-400">Loading predictions...</div>;
  }

  return (
    <div className="space-y-6 pt-8">
      <style>{`
        .custom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #BA5A5A;
          cursor: pointer;
          transition: transform 0.1s ease;
          border: 3px solid #FFFFFF;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }
        .custom-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #BA5A5A;
          cursor: pointer;
          transition: transform 0.1s ease;
          border: 3px solid #FFFFFF;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }
      `}</style>

      {/* Header Info with Stat Pills */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
            {activeTab === '24h' ? 'MargPredict — 24h Forecast' : 'MargPredict — Sub-Hourly ML Forecast'}
          </h2>
          <p className="mt-1 text-xs text-gray-400 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
            {activeTab === '24h'
              ? 'Top 10 high-risk zones powered by Prophet time-series forecasting'
              : 'Real-time short-term predictions powered by RandomForest ML'}
          </p>
        </div>
        
        {/* Four Header Pills */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Pill 1: Live */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-sm">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <div>
              <div className="text-[10px] font-bold text-gray-900 leading-tight">LIVE</div>
              <div className="text-[10px] text-gray-400 font-semibold leading-tight">Real-time updates</div>
            </div>
          </div>

          {/* Pill 2: Traffic */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-sm">
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <div>
              <div className="text-[10px] font-bold text-gray-900 leading-tight">Traffic</div>
              <div className="text-[10px] text-gray-400 font-semibold leading-tight">Bengaluru Violation Density</div>
            </div>
          </div>

          {/* Pill 3: Last hour */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-sm">
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="text-[10px] font-bold text-gray-900 leading-tight">Last hour</div>
              <div className="text-[10px] text-gray-400 font-semibold leading-tight">
                {lastTick?.kpis?.violations_last_hour ?? 0} violations
              </div>
            </div>
          </div>

          {/* Pill 4: Stream */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-sm">
            <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
            <div>
              <div className="text-[10px] font-bold text-gray-900 leading-tight">Stream</div>
              <div className="text-[10px] text-gray-400 font-semibold leading-tight">
                {lastTick?.kpis?.active_streams ?? 5} events
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Selector Toggle */}
      <div className="flex border-b border-gray-100 mb-2">
        <button
          onClick={() => setActiveTab('24h')}
          className={`pb-3 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
            activeTab === '24h'
              ? 'border-[#BA5A5A] text-[#BA5A5A]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          24h Forecast (Prophet)
        </button>
        <button
          onClick={() => setActiveTab('short-term')}
          className={`pb-3 px-6 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
            activeTab === 'short-term'
              ? 'border-[#BA5A5A] text-[#BA5A5A]'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          Sub-Hourly ML Forecast (Random Forest)
        </button>
      </div>

      {/* Simulation Timeline (Only for 24h tab) */}
      {activeTab === '24h' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4 shrink-0">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                title={isPlaying ? "Pause simulation" : "Play simulation"}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FDF2F2] text-[#BA5A5A] hover:bg-[#FBE8E8] active:scale-95 transition-all shadow-inner cursor-pointer"
              >
                {isPlaying ? (
                  <svg className="h-5 w-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Time Travel Simulation</p>
                <h3 className="text-2xl font-black text-gray-900">
                  {formatTime(selectedHour)}
                </h3>
              </div>
            </div>
            <div className="flex-1 w-full md:px-8">
              <input
                type="range"
                min="0"
                max="23"
                value={selectedHour}
                onChange={(e) => {
                  setSelectedHour(parseInt(e.target.value));
                  setIsPlaying(false);
                }}
                className="custom-slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-100 focus:outline-none transition-all duration-300"
                style={{
                  background: `linear-gradient(90deg, #BA5A5A ${(selectedHour / 23) * 100}%, #F3F4F6 ${(selectedHour / 23) * 100}%)`
                }}
              />
              <div className="mt-2 flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>12:00 AM</span>
                <span>06:00 AM</span>
                <span>Noon</span>
                <span>06:00 PM</span>
                <span>11:00 PM</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weather Strip (Only for 24h tab) */}
      {activeTab === '24h' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between overflow-hidden relative shadow-sm">
          {/* Left Side */}
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF6EC] text-[#D29C42]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">
                {predictions?.weather_escalation?.condition || 'Clear Sky'}
              </div>
              <div className="text-xs text-gray-400 font-semibold mt-0.5">
                {predictions?.weather_escalation?.temperature || '28'}°C · Humidity {predictions?.weather_escalation?.humidity || '60'}%
              </div>
            </div>

            <div className="bg-[#EEF7F2] text-[#489C6F] font-bold text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 ml-2">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Normal risk levels</span>
            </div>
          </div>

          {/* 3D City Skyline Silhouette Graphic */}
          <div className="absolute bottom-0 right-0 h-16 w-80 pointer-events-none select-none z-0">
            <svg className="w-full h-full text-gray-100" viewBox="0 0 320 64" fill="currentColor">
              <path d="M0,64 L0,48 L15,48 L15,35 L30,35 L30,56 L45,56 L45,42 L60,42 L60,64 L75,64 L75,38 L90,38 L90,64 H105 V44 H120 V64 H135 V30 H150 V64 H165 V40 H180 V64 H195 V32 H210 V64 H225 V48 H240 V64 H255 V36 H270 V64 H285 V44 H300 V64 H320 V64 Z" opacity="0.4" />
              <path d="M10,64 L10,54 L25,54 L25,44 L40,44 L40,58 L55,58 L55,48 L70,48 L70,64 L85,64 L85,46 L100,46 L100,64 H115 V52 H130 V64 H145 V36 H160 V64 H175 V46 H190 V64 H205 V38 H220 V64 H235 V52 H250 V64 H265 V42 H280 V64 H295 H310 V64 Z" opacity="0.75" />
            </svg>
          </div>
        </div>
      )}

      {/* ML Status Strip (Only for short-term tab) */}
      {activeTab === 'short-term' && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between overflow-hidden relative shadow-sm">
          <div className="flex items-center gap-4 relative z-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF7F2] text-[#489C6F]">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800">
                Random Forest Regressor (Global Model)
              </div>
              <div className="text-xs text-gray-400 font-semibold mt-0.5">
                Features: Lags (15m, 30m, 45m) · 1h Rolling Mean · Time Variables · Zone Coordinates
              </div>
            </div>
            <div className="bg-[#EEF7F2] text-[#489C6F] font-bold text-[10px] px-3 py-1 rounded-full flex items-center gap-1.5 ml-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span>Model Active &amp; Trained</span>
            </div>
          </div>

          {/* 3D City Skyline Silhouette Graphic */}
          <div className="absolute bottom-0 right-0 h-16 w-80 pointer-events-none select-none z-0">
            <svg className="w-full h-full text-gray-100" viewBox="0 0 320 64" fill="currentColor">
              <path d="M0,64 L0,48 L15,48 L15,35 L30,35 L30,56 L45,56 L45,42 L60,42 L60,64 L75,64 L75,38 L90,38 L90,64 H105 V44 H120 V64 H135 V30 H150 V64 H165 V40 H180 V64 H195 V32 H210 V64 H225 V48 H240 V64 H255 V36 H270 V64 H285 V44 H300 V64 H320 V64 Z" opacity="0.4" />
              <path d="M10,64 L10,54 L25,54 L25,44 L40,44 L40,58 L55,58 L55,48 L70,48 L70,64 L85,64 L85,46 L100,46 L100,64 H115 V52 H130 V64 H145 V36 H160 V64 H175 V46 H190 V64 H205 V38 H220 V64 H235 V52 H250 V64 H265 V42 H280 V64 H295 H310 V64 Z" opacity="0.75" />
            </svg>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 items-start">
        {/* Left Column: Risk Rankings Bar Chart */}
        {activeTab === 'short-term' ? (
          <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Sub-Hourly Violations Forecast</h3>
                <div className="text-gray-400 border border-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold cursor-help" title="Predicted violations for the next 15-minute and 30-minute horizons">
                  i
                </div>
              </div>
              <div className="text-xs font-bold text-[#BA5A5A] bg-[#FDF2F2] px-2.5 py-1.5 rounded-lg">
                Model: RandomForestRegressor
              </div>
            </div>

            <div className="h-80 w-full relative">
              <ResponsiveContainer width="99%" height="100%">
                <BarChart data={shortTermChartData} layout="vertical" margin={{ left: -10, right: 30, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 'dataMax + 5']} hide />
                  <YAxis dataKey="zone" type="category" width={80} tickLine={false} axisLine={false} tick={{ fill: '#4B5563', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === 'predicted_15m' ? 'Predicted (15m)' : 'Predicted (30m Cumulative)'
                    ]}
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    labelStyle={{ color: '#1F2937', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="predicted_15m" fill="#BA5A5A" radius={[0, 6, 6, 0]} name="Next 15m" barSize={8}>
                    <LabelList dataKey="predicted_15m" position="right" style={{ fill: '#4B5563', fontSize: 9, fontWeight: 800 }} />
                  </Bar>
                  <Bar dataKey="predicted_30m" fill="#E67E22" radius={[0, 6, 6, 0]} name="Next 30m" barSize={8}>
                    <LabelList dataKey="predicted_30m" position="right" style={{ fill: '#4B5563', fontSize: 9, fontWeight: 800 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-3 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">Risk Rankings</h3>
                <div className="text-gray-400 border border-gray-200 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold cursor-help" title="Visualizes risk scores derived from predictions">
                  i
                </div>
              </div>
              <select
                value={rankingMetric}
                onChange={(e) => setRankingMetric(e.target.value)}
                className="text-xs font-bold text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white outline-none cursor-pointer hover:border-gray-300 shadow-sm"
              >
                <option value="risk">Risk Score</option>
                <option value="violations">Violations</option>
              </select>
            </div>

            <div className="h-80 w-full relative">
              <ResponsiveContainer width="99%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 30, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="zone" type="category" width={80} tickLine={false} axisLine={false} tick={{ fill: '#4B5563', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip
                    formatter={(value, name) => [
                      value,
                      name === 'risk' ? 'Risk Score' : 'Predicted Violations'
                    ]}
                    contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    labelStyle={{ color: '#1F2937', fontWeight: 'bold' }}
                  />
                  <Bar dataKey={rankingMetric} radius={[0, 6, 6, 0]} barSize={12}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                    ))}
                    <LabelList dataKey={rankingMetric} position="right" style={{ fill: '#4B5563', fontSize: 11, fontWeight: 800 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Right Column: Top High-Risk Zones List */}
        {activeTab === 'short-term' ? (
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Top High-Risk Zones (ML)</h3>
                <button
                  onClick={() => setShowAllZones(prev => !prev)}
                  className="text-xs font-bold text-[#BA5A5A] hover:underline cursor-pointer"
                >
                  {showAllZones ? 'Show less' : 'View all →'}
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {sortedShortTerm.slice(0, showAllZones ? 16 : 3).map((zone, idx) => {
                  const rankColorClass = idx === 0
                    ? 'bg-[#FDF2F2] text-[#BA5A5A]'
                    : idx === 1
                    ? 'bg-[#FEF6EC] text-[#D29C42]'
                    : idx === 2
                    ? 'bg-[#F0FDF4] text-[#489C6F]'
                    : 'bg-gray-50 text-gray-500';
                  
                  const confColorClass = zone.confidence >= 0.8
                    ? 'bg-[#EAFDF3] text-[#2B7D50]'
                    : zone.confidence >= 0.6
                    ? 'bg-[#FEF6EC] text-[#B87C21]'
                    : 'bg-[#FDF2F2] text-[#BA5A5A]';

                  const trend = zone.predicted_30m > zone.predicted_15m * 1.5
                    ? { icon: '📈', text: 'Spike Expected', color: 'text-red-500' }
                    : zone.predicted_30m > zone.predicted_15m
                    ? { icon: '↗️', text: 'Increasing', color: 'text-orange-500' }
                    : zone.predicted_30m < zone.predicted_15m
                    ? { icon: '↘️', text: 'Decreasing', color: 'text-green-500' }
                    : { icon: '➡️', text: 'Stable', color: 'text-gray-500' };

                  return (
                    <div key={zone.zone} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${rankColorClass}`}>
                          #{idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-gray-800 truncate">{zone.zone}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${confColorClass}`}>
                              {Math.round(zone.confidence * 100)}% conf
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-400 font-semibold">
                            Current: <span className="text-gray-600 font-bold">{zone.current_violations}</span> · 
                            15m: <span className="text-gray-800 font-bold">{zone.predicted_15m}</span> · 
                            30m: <span className="text-gray-800 font-bold">{zone.predicted_30m}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 pl-2">
                        <div className="text-right">
                          <span className={`text-xs font-bold ${trend.color} flex items-center gap-0.5 justify-end`}>
                            <span>{trend.icon}</span>
                          </span>
                          <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-tight">{trend.text}</span>
                        </div>
                        <div className="shrink-0 text-right pl-1">
                          <div className="text-[9px] font-bold text-gray-400 uppercase leading-none">30m ML</div>
                          <div className="text-lg font-black text-gray-900 leading-tight mt-0.5">
                            +{zone.predicted_30m}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowAllZones(prev => !prev)}
              className="w-full text-center text-xs font-bold text-[#BA5A5A] bg-[#FDF2F2] hover:bg-[#FBE8E8] py-3.5 rounded-xl transition-all cursor-pointer mt-4"
            >
              {showAllZones ? 'Show less' : 'View all 16 ML predictions →'}
            </button>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Top High-Risk Zones</h3>
                <button
                  onClick={() => setShowAllZones(prev => !prev)}
                  className="text-xs font-bold text-[#BA5A5A] hover:underline cursor-pointer"
                >
                  {showAllZones ? 'Show less' : 'View all →'}
                </button>
              </div>

              <div className="divide-y divide-gray-50">
                {simulatedZones.slice(0, showAllZones ? 10 : 3).map((zone, idx) => {
                  const rankColorClass = idx === 0
                    ? 'bg-[#FDF2F2] text-[#BA5A5A]'
                    : idx === 1
                    ? 'bg-[#FEF6EC] text-[#D29C42]'
                    : idx === 2
                    ? 'bg-[#F0FDF4] text-[#489C6F]'
                    : 'bg-gray-50 text-gray-500';
                  return (
                    <div key={zone.zone} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${rankColorClass}`}>
                          #{zone.simulatedRank}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-gray-800 truncate">{zone.zone}</span>
                            {zone.weather_boosted && (
                              <span className="rounded bg-[#FEF6EC] px-1.5 py-0.5 text-[9px] font-bold text-[#D29C42]">
                                🌧️ Rain
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-400 font-semibold">
                            {zone.simulatedViolations} violations · Peak {formatTime(zone.peak_hour)}
                          </p>
                        </div>
                      </div>

                      {/* Dynamic SVG Sparkline peaking at peak hour */}
                      <div className="w-20 sm:w-24 h-8 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 80 24">
                          <defs>
                            <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#BA5A5A" stopOpacity="0.2" />
                              <stop offset="100%" stopColor="#BA5A5A" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          {/* Area Path */}
                          <path
                             d={`${generateSparklineAreaPath(zone.peak_hour)} L 80,24 L 0,24 Z`}
                            fill={`url(#grad-${idx})`}
                          />
                          {/* Line Path */}
                          <path
                            d={generateSparklinePath(zone.peak_hour)}
                            fill="none"
                            stroke="#BA5A5A"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          {/* Peak Dot */}
                          <circle
                            cx="40"
                            cy={12}
                            r="3"
                            fill="#BA5A5A"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>

                      {/* Risk Score Display */}
                      <div className="shrink-0 text-right pl-3">
                        <div className="text-[9px] font-bold text-gray-400 uppercase leading-none">Risk Score</div>
                        <div className="text-xl font-black text-gray-900 leading-tight mt-0.5">
                          {zone.simulatedRisk}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setShowAllZones(prev => !prev)}
              className="w-full text-center text-xs font-bold text-[#BA5A5A] bg-[#FDF2F2] hover:bg-[#FBE8E8] py-3.5 rounded-xl transition-all cursor-pointer mt-4"
            >
              {showAllZones ? 'Show less' : 'View all 10 high-risk zones →'}
            </button>
          </div>
        )}
      </div>

      {/* Heatmap Card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Simulated Traffic &amp; Congestion Heatmap</h3>
            <p className="text-xs text-gray-400">Simulated congestion levels based on prediction criteria</p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5 border border-gray-200 shrink-0 self-start sm:self-center">
            <button
              onClick={() => setMapView('2d')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mapView === '2d'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              2D Heatmap
            </button>
            <button
              onClick={() => setMapView('3d')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                mapView === '3d'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-450 hover:text-gray-700'
              }`}
            >
              3D Digital Twin
            </button>
          </div>
        </div>
        
        <Suspense fallback={
          <div className="h-[280px] sm:h-[350px] md:h-[400px] animate-pulse bg-command-panel border border-command-border rounded-xl flex items-center justify-center text-xs text-command-muted">
            Initializing mapping view...
          </div>
        }>
          {mapView === '2d' ? (
            <HeatMap data={heatmap} zoneIntensity={simulatedZoneIntensity} className="h-[280px] sm:h-[350px] md:h-[400px]" />
          ) : (
            <DigitalTwinMap 
              zoneIntensity={simulatedZoneIntensity}
              trafficData={trafficData}
              violationsData={heatmap?.features || []}
              className="h-[280px] sm:h-[350px] md:h-[400px]"
            />
          )}
        </Suspense>
      </div>

      <ShiftPlanner data={shiftData} />
    </div>
  );
}
