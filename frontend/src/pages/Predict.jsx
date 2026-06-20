import { useCallback, useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import HeatMap from '../components/HeatMap';
import ShiftPlanner from '../components/ShiftPlanner';
import LiveStatusBar from '../components/LiveStatusBar';
import WeatherBanner from '../components/WeatherBanner';

const RISK_COLORS = [
  '#C27A7A', // Rank 1 (Danger rose)
  '#CD8D8D', // Rank 2
  '#D8A0A0', // Rank 3
  '#E3B3B3', // Rank 4
  '#E6CCA0', // Rank 5 (Warning cream/orange)
  '#D7E1D4', // Rank 6
  '#C9DCCE', // Rank 7
  '#BBD6C7', // Rank 8
  '#ADCFC1', // Rank 9
  '#9FC9BA', // Rank 10 (Sage success)
];

export default function Predict() {
  const [predictions, setPredictions] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedHour, setSelectedHour] = useState(new Date().getHours());
  const [isPlaying, setIsPlaying] = useState(false);

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
      const [pr, sh, hm] = await Promise.all([
        api.getPredictions(),
        api.getShiftPlanner(),
        api.getHeatmap(5000),
      ]);
      setPredictions(pr.data);
      setShiftData(sh.data);
      setHeatmap(hm.data);
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
    return simulatedZones.map((z) => ({
      zone: z.zone.replace(' Layout', '').replace(' Board', ''),
      risk: z.simulatedRisk,
      violations: z.simulatedViolations,
      rank: z.simulatedRank,
    }));
  }, [simulatedZones]);

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

  if (loading) {
    return <div className="text-center text-gray-400">Loading predictions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">ParkPredict — 24h Forecast</h2>
          <p className="mt-1 text-sm text-command-muted">
            Top 10 high-risk zones powered by Prophet time-series forecasting
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      {/* Simulation Scrubbing Timeline */}
      <div className="rounded-xl border border-command-border bg-command-panel p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-command-accent text-white hover:opacity-90 active:scale-95 transition-all shadow-md shadow-command-accent/20 cursor-pointer"
            >
              {isPlaying ? (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-command-muted">Time Travel Simulation</p>
              <h3 className="text-lg font-extrabold text-gray-800">
                {selectedHour === 12 ? '12:00 PM (Noon)' : selectedHour === 0 ? '12:00 AM (Midnight)' : selectedHour > 12 ? `${selectedHour - 12}:00 PM` : `${selectedHour}:00 AM`}
              </h3>
            </div>
          </div>
          <div className="flex-1 md:px-8">
            <input
              type="range"
              min="0"
              max="23"
              value={selectedHour}
              onChange={(e) => {
                setSelectedHour(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-command-bg accent-command-accent focus:outline-none"
              style={{
                background: `linear-gradient(90deg, #486E5D ${(selectedHour/23)*100}%, #E5EEE4 ${(selectedHour/23)*100}%)`
              }}
            />
            <div className="mt-1.5 flex justify-between text-[10px] font-bold text-command-muted uppercase tracking-wider">
              <span>Midnight</span>
              <span>06:00 AM</span>
              <span>Noon</span>
              <span>06:00 PM</span>
              <span>11:00 PM</span>
            </div>
          </div>
        </div>
      </div>


      <WeatherBanner
        weatherData={predictions?.weather_escalation}
        liveWeather={lastTick?.weather}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-command-border bg-command-panel p-6 interactive-card shadow-sm">
          <h3 className="text-lg font-semibold text-white">Risk Rankings</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis dataKey="zone" type="category" width={90} tick={{ fill: '#4A5851', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E5EEE4', borderRadius: 12, boxShadow: '0 8px 16px -4px rgba(80,114,100,0.1)' }}
                  labelStyle={{ color: '#1F2925', fontWeight: 'bold' }}
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
          {simulatedZones.map((zone) => (
            <div
              key={zone.zone}
              onClick={() => setSelectedZone(selectedZone === zone.zone ? null : zone.zone)}
              className="flex flex-col rounded-xl border border-command-border bg-command-panel p-4 interactive-card shadow-sm cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-command-accent/10 text-lg font-bold text-command-accent">
                  #{zone.simulatedRank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{zone.zone}</span>
                      {zone.weather_boosted && (
                        <span className="rounded bg-command-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-command-warning">
                          🌧️ Rain
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-command-danger">Risk {zone.simulatedRisk}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {zone.simulatedViolations} violations · Peak {zone.peak_hour}:00
                  </p>
                </div>
              </div>
              
              {selectedZone === zone.zone && (
                <div className="mt-3 border-t border-command-border/50 pt-3 text-xs text-gray-600 space-y-2.5 expand-slide">
                  <div className="grid grid-cols-2 gap-2 bg-command-bg/50 p-2.5 rounded-lg border border-command-border/30">
                    <div>
                      <p className="text-[10px] text-command-muted font-bold uppercase tracking-wider">Confidence Level</p>
                      <p className="font-semibold text-gray-800 mt-0.5">{(zone.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-command-muted font-bold uppercase tracking-wider">Historical Drivers</p>
                      <p className="font-semibold text-gray-800 mt-0.5 truncate">{zone.drivers?.slice(0, 2).join(', ') || 'No Parking'}</p>
                    </div>
                  </div>
                  <p className="text-xs bg-command-accent/5 p-2 rounded-lg text-command-accent/90 border border-command-accent/10">
                    💡 **Guidance:** Congestion probability surges near **{zone.peak_hour}:00**. Dispatching patrols 30m prior is advised.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <HeatMap data={heatmap} zoneIntensity={simulatedZoneIntensity} className="h-[280px] sm:h-[350px] md:h-[400px]" />
      <ShiftPlanner data={shiftData} />
    </div>
  );
}
