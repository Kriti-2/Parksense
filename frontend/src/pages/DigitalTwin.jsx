import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useTranslation } from '../context/LanguageContext';
import PageLoader from '../components/PageLoader';
import DigitalTwinMap from '../components/DigitalTwinMap';

export default function DigitalTwin() {
  const { t } = useTranslation();
  const [heatmap, setHeatmap] = useState(null);
  const [trafficData, setTrafficData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [lastTick, setLastTick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live WebSocket Tick Handler
  const handleLiveTick = useCallback((payload) => {
    if (payload.type !== 'live_tick') return;
    setLastTick(payload);
    
    // Update live zone intensities
    if (payload.zone_intensity) {
      setHeatmap((prev) =>
        prev ? { ...prev, zone_intensity: payload.zone_intensity, generated_at: payload.timestamp } : prev
      );
    }
  }, []);

  const { connected } = useLiveFeed(handleLiveTick);

  // Load Initial API Data
  const loadData = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [hm, tr, an] = await Promise.all([
        api.getHeatmap(1500),
        api.getTrafficRoutes(),
        api.getAnalytics()
      ]);
      setHeatmap(hm.data);
      setTrafficData(tr.data);
      setAnalytics(an.data);
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to load digital twin data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <PageLoader loadingText="Initializing 3D Digital Twin environment..." />;
  }

  if (error) {
    return <PageLoader error={error} onRetry={loadData} />;
  }

  const zoneIntensity = heatmap?.zone_intensity || {};
  const violationsData = heatmap?.features || [];

  // Derived stats for side panel
  const activeHotspots = Object.values(zoneIntensity).filter(
    (z) => z.congestion_score >= 50
  ).length;

  const avgCongestion = Object.values(zoneIntensity).length > 0
    ? Math.round(Object.values(zoneIntensity).reduce((sum, z) => sum + z.congestion_score, 0) / Object.values(zoneIntensity).length)
    : 30;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn h-full">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">3D Digital Twin Map</h2>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            connected ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {connected ? 'CONNECTED TO FEED' : 'OFFLINE FEED'}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-gray-400">
          Interactive real-time 3D twin of Bengaluru city buildings, traffic flows, and congestion pillars.
        </p>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Left Side Twin Panels */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Global Twin Metrics */}
          <div className="rounded-xl border border-command-border bg-command-card p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-command-header mb-4">Twin Telemetry</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-command-border">
                <span className="text-xs text-command-muted">Avg Congestion</span>
                <span className="text-sm font-bold text-command-accent">{avgCongestion}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-command-border">
                <span className="text-xs text-command-muted">Active Hotspots</span>
                <span className="text-sm font-bold text-orange-500">{activeHotspots} Zones</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-command-border">
                <span className="text-xs text-command-muted">Violations Cached</span>
                <span className="text-sm font-bold text-red-500">{violationsData.length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-command-muted">Last Update</span>
                <span className="text-[10px] font-mono text-gray-400">
                  {lastTick ? new Date(lastTick.timestamp).toLocaleTimeString() : 'Static Cache'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Hotspots Ranking */}
          <div className="rounded-xl border border-command-border bg-command-card p-4 flex-1 flex flex-col min-h-[300px]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-command-header mb-3">Hotspot Diagnostics</h3>
            <div className="overflow-y-auto max-h-[350px] no-scrollbar flex-1 space-y-2">
              {Object.entries(zoneIntensity)
                .sort((a, b) => b[1].congestion_score - a[1].congestion_score)
                .map(([zone, meta]) => (
                  <div 
                    key={zone} 
                    className="flex justify-between items-center p-2 rounded bg-command-panel/50 border border-command-border/50 hover:bg-command-panel transition-colors"
                  >
                    <div>
                      <div className="text-xs font-bold text-gray-800">{zone}</div>
                      <div className="text-[9px] uppercase font-semibold text-gray-400 mt-0.5">{meta.level} RISK</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            meta.congestion_score >= 75 ? 'bg-red-500' : meta.congestion_score >= 50 ? 'bg-orange-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${meta.congestion_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-700 min-w-[28px] text-right">{meta.congestion_score}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right Side 3D Map Viewport */}
        <div className="lg:col-span-3 h-[500px] md:h-[600px] w-full">
          <DigitalTwinMap 
            zoneIntensity={zoneIntensity}
            trafficData={trafficData}
            violationsData={violationsData}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
