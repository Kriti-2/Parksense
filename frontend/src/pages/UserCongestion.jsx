import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import TiltCard from '../components/TiltCard';
import { useTranslation, TranslatedText } from '../context/LanguageContext';
import PageLoader from '../components/PageLoader';
import { useAuth } from '../context/AuthContext';

const BENGALURU_CENTER = [12.9716, 77.5946];
const ADVISORY_COLORS = { red: '#A33B3B', orange: '#C0613F', green: '#3D5A4A' };

const LOCATIONS = [
  { name: 'Silk Board Junction', coords: [12.9177, 77.6225] },
  { name: 'Koramangala 80ft Rd', coords: [12.9352, 77.6245] },
  { name: 'MG Road Metro Stn', coords: [12.9750, 77.6063] },
  { name: 'Indiranagar 100ft Rd', coords: [12.9784, 77.6408] },
  { name: 'Whitefield ITPL', coords: [12.9698, 77.7500] },
  { name: 'HSR Layout Sector 1', coords: [12.9116, 77.6473] },
  { name: 'Majestic Bus Stand', coords: [12.9766, 77.5712] },
  { name: 'Electronic City Phase 1', coords: [12.8452, 77.6602] },
  { name: 'Hebbal Flyover', coords: [13.0358, 77.5978] },
  { name: 'Jayanagar 4th Block', coords: [12.9284, 77.5824] },
  { name: 'Yelahanka New Town', coords: [13.0978, 77.5862] },
  { name: 'Marathahalli Bridge', coords: [12.9592, 77.6974] },
  { name: 'Malleshwaram 18th Cross', coords: [12.9984, 77.5720] },
  { name: 'Banashankari TTMC', coords: [12.9156, 77.5736] },
  { name: 'BTM Layout 2nd Stage', coords: [12.9166, 77.6083] },
  { name: 'Rajajinagar Metro', coords: [12.9892, 77.5562] },
];

function FitRouteBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (!route || !route.length) return;
    map.fitBounds(route, { padding: [50, 50] });
  }, [route, map]);
  return null;
}

function ComplianceRing({ score }) {
  const radius = 30;
  const strokeWidth = 5;
  const normalizedRadius = radius - strokeWidth / 2; // = 27.5 (keeps circle centered and maximizes space inside)
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: '64px', height: '64px' }}>
      <svg className="block" width="64" height="64" viewBox="0 0 64 64" style={{ width: '64px', height: '64px', minWidth: '64px', minHeight: '64px' }}>
        <g transform="rotate(-90 32 32)">
          <circle
            className="text-command-border stroke-current"
            strokeWidth={strokeWidth}
            fill="transparent"
            r={normalizedRadius}
            cx="32"
            cy="32"
          />
          <circle
            className="text-command-success stroke-current transition-all duration-500"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx="32"
            cy="32"
          />
        </g>
      </svg>
      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-center" style={{ width: '64px', height: '64px' }}>
        <span className="text-xs font-extrabold text-gray-800 dark:text-white">{score}%</span>
      </div>
    </div>
  );
}

function CarbonTree({ savings }) {
  const leafCount = Math.min(12, Math.max(3, Math.floor(savings * 3.5)));
  
  const leafPositions = [
    { cx: 50, cy: 30, r: 9, color: '#486E5D' },
    { cx: 38, cy: 38, r: 11, color: '#52B788' },
    { cx: 62, cy: 38, r: 11, color: '#486E5D' },
    { cx: 45, cy: 25, r: 10, color: '#9FC9BA' },
    { cx: 55, cy: 25, r: 10, color: '#52B788' },
    { cx: 30, cy: 45, r: 9, color: '#C0E1D2' },
    { cx: 70, cy: 45, r: 9, color: '#486E5D' },
    { cx: 42, cy: 48, r: 8, color: '#9FC9BA' },
    { cx: 58, cy: 48, r: 8, color: '#52B788' },
    { cx: 50, cy: 15, r: 7, color: '#C0E1D2' },
    { cx: 32, cy: 32, r: 7, color: '#486E5D' },
    { cx: 68, cy: 32, r: 7, color: '#9FC9BA' },
  ];

  const visibleLeaves = leafPositions.slice(0, leafCount);

  return (
    <svg className="h-16 w-16 shrink-0 transition-all duration-500" viewBox="0 0 100 100">
      <path d="M20 80 Q50 76 80 80" stroke="#E5EEE4" strokeWidth="2" fill="none" />
      <path d="M48 80 L48 52 Q48 48 42 43 L45 43 Q49 48 49 52 L51 52 Q51 45 56 41 L58 42 Q53 48 51 52 L51 80 Z" fill="#8B5E3C" />
      {visibleLeaves.map((leaf, index) => (
        <circle
          key={index}
          cx={leaf.cx}
          cy={leaf.cy}
          r={leaf.r}
          fill={leaf.color}
          className="transition-all duration-500 transform origin-bottom animate-pulse"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
      {savings >= 3.0 && (
        <>
          <circle cx="50" cy="30" r="3.5" fill="#DC9B9B" className="animate-ping" />
          <circle cx="38" cy="38" r="3.5" fill="#DC9B9B" className="animate-ping" style={{ animationDelay: '300ms' }} />
          <circle cx="62" cy="38" r="3.5" fill="#DC9B9B" className="animate-ping" style={{ animationDelay: '600ms' }} />
        </>
      )}
    </svg>
  );
}

export default function UserCongestion() {
  const { t } = useTranslation();
  const { user, updateUserData } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cumulative eco gamification states initialized from database user model
  const [totalSavings, setTotalSavings] = useState(user?.eco_co2_offset ?? 0.0);
  const [totalFuelSaved, setTotalFuelSaved] = useState(user?.eco_fuel_saved ?? 0.0);
  const [totalTimeSaved, setTotalTimeSaved] = useState(user?.eco_time_saved ?? 0.0);

  // Routing state
  const [origin, setOrigin] = useState('Silk Board Junction');
  const [destination, setDestination] = useState('MG Road Metro Stn');
  const [calculatedRoutes, setCalculatedRoutes] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);

  // State to manage real route calculation status
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [recordingCommute, setRecordingCommute] = useState(false);
  const [routeSuccessMessage, setRouteSuccessMessage] = useState(null);

  // Keep state synchronized with database profile load/refresh
  useEffect(() => {
    if (user) {
      setTotalSavings(user.eco_co2_offset ?? 0.0);
      setTotalFuelSaved(user.eco_fuel_saved ?? 0.0);
      setTotalTimeSaved(user.eco_time_saved ?? 0.0);
    }
  }, [user]);

  const loadPreview = useCallback(() => {
    setError(null);
    api.getCongestionPreview().then((res) => {
      setData(res.data);
      setLoading(false);
    }).catch((err) => {
      setError(err.message || 'Failed to load congestion data');
      setLoading(false);
    });
  }, []);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick' && payload.zone_intensity) {
      loadPreview();
    }
  }, [loadPreview]);

  useLiveFeed(handleLiveTick);

  useEffect(() => {
    loadPreview();
    const interval = setInterval(loadPreview, 30000);
    return () => clearInterval(interval);
  }, [loadPreview]);

  const handleCalculateRoute = () => {
    const originLoc = LOCATIONS.find(l => l.name === origin);
    const destLoc = LOCATIONS.find(l => l.name === destination);
    if (!originLoc || !destLoc) return;

    const start = originLoc.coords;
    const end = destLoc.coords;

    setCalculatingRoute(true);
    setRouteSuccessMessage(null);

    api.calculateRoute(start[0], start[1], end[0], end[1])
      .then((res) => {
        setCalculatedRoutes({
          standard: res.data.standard_route,
          eco: res.data.eco_route
        });

        const stats = res.data.stats;
        setRouteDetails({
          stdDist: stats.std_dist_km,
          ecoDist: stats.eco_dist_km,
          stdTime: stats.std_time_mins,
          ecoTime: stats.eco_time_mins,
          stdFuel: stats.std_fuel_liters,
          ecoFuel: stats.eco_fuel_liters,
          stdCo2: stats.std_co2_kg,
          ecoCo2: stats.eco_co2_kg,
          timeSaved: stats.time_saved_mins,
          timePct: stats.time_saved_pct,
          co2Saved: stats.co2_saved_kg,
          co2Pct: stats.co2_saved_pct,
          fuelSaved: stats.fuel_saved_liters,
          fuelPct: stats.fuel_saved_pct
        });
      })
      .catch((err) => {
        console.error("OSRM route calculation failed. Falling back to direct lines...", err);
        // Fallback mock routing logic if OSRM is down
        const midLat = start[0] + (end[0] - start[0]) * 0.5;
        const midLng = start[1] + (end[1] - start[1]) * 0.5;
        const stdMid = [midLat - 0.008, midLng - 0.004];
        const ecoMid = [midLat + 0.008, midLng + 0.006];

        setCalculatedRoutes({
          standard: [start, stdMid, end],
          eco: [start, ecoMid, end]
        });

        const stdDist = (Math.hypot(start[0]-end[0], start[1]-end[1]) * 100).toFixed(1);
        const ecoDist = (parseFloat(stdDist) * 1.15).toFixed(1);
        const stdTime = Math.round(parseFloat(stdDist) * 4.5);
        const ecoTime = Math.round(parseFloat(ecoDist) * 2.2);
        const stdFuel = (parseFloat(stdDist) * 0.13).toFixed(2);
        const ecoFuel = (parseFloat(ecoDist) * 0.065).toFixed(2);
        const stdCo2 = (parseFloat(stdFuel) * 2.3).toFixed(2);
        const ecoCo2 = (parseFloat(ecoFuel) * 2.3).toFixed(2);
        const timeSaved = stdTime - ecoTime;
        const co2Saved = (parseFloat(stdCo2) - parseFloat(ecoCo2)).toFixed(2);
        const fuelSaved = (parseFloat(stdFuel) - parseFloat(ecoFuel)).toFixed(2);

        setRouteDetails({
          stdDist, ecoDist, stdTime, ecoTime, stdFuel, ecoFuel, stdCo2, ecoCo2,
          timeSaved, timePct: Math.round((timeSaved / stdTime) * 100),
          co2Saved, co2Pct: Math.round((co2Saved / stdCo2) * 100),
          fuelSaved, fuelPct: Math.round((fuelSaved / stdFuel) * 100)
        });
      })
      .finally(() => {
        setCalculatingRoute(false);
      });
  };

  const handleConfirmEcoCommute = () => {
    if (!routeDetails) return;
    setRecordingCommute(true);

    const co2Saved = parseFloat(routeDetails.co2Saved);
    const fuelSaved = parseFloat(routeDetails.fuelSaved);
    const timeSaved = parseInt(routeDetails.timeSaved);

    api.recordCommute(co2Saved, fuelSaved, timeSaved)
      .then((res) => {
        setRouteSuccessMessage(`🌿 Commuted Eco-Smart! Saved ${co2Saved}kg CO₂, ${fuelSaved}L fuel and ${timeSaved} mins!`);
        if (user) {
          updateUserData({
            ...user,
            eco_co2_offset: res.data.eco_co2_offset,
            eco_fuel_saved: res.data.eco_fuel_saved,
            eco_time_saved: res.data.eco_time_saved,
          });
        }
        setTotalSavings(res.data.eco_co2_offset);
        setTotalFuelSaved(res.data.eco_fuel_saved);
        setTotalTimeSaved(res.data.eco_time_saved);

        setTimeout(() => setRouteSuccessMessage(null), 6000);
      })
      .catch((err) => {
        console.error("Failed to record commute to DB:", err);
      })
      .finally(() => {
        setRecordingCommute(false);
      });
  };

  if (loading) {
    return <PageLoader loadingText="Loading congestion data..." />;
  }

  if (error) {
    return <PageLoader error={error} onRetry={loadPreview} />;
  }

  const zones = data?.zones || [];

  return (
    <div className="space-y-6">
      
      {/* Gamified Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Apple Activity compliance ring */}
        <TiltCard className="rounded-xl border border-command-border bg-command-panel p-4 flex items-center gap-4 interactive-card shadow-sm">
          <ComplianceRing score={Math.min(100, Math.round(totalSavings * 20))} />
          <div className="text-left">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider"><TranslatedText text="Compliance Ring" /></h4>
            <p className="text-[10px] text-command-muted mt-0.5 leading-relaxed"><TranslatedText text="Ratio of eco-smart commute selections" /></p>
          </div>
        </TiltCard>

        {/* Card 2: Vector Carbon Tree */}
        <TiltCard className="rounded-xl border border-command-border bg-command-panel p-4 flex items-center gap-4 interactive-card shadow-sm justify-between">
          <div className="flex items-center gap-4">
            <CarbonTree savings={totalSavings} />
            <div className="text-left">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider"><TranslatedText text="Smart Carbon Tree" /></h4>
              <p className="text-[10px] text-command-muted mt-0.5 leading-relaxed"><TranslatedText text="Grows new leaves as you save CO₂" /></p>
            </div>
          </div>
          <span className="text-[8px] bg-command-success text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
            {totalSavings >= 3.0 ? <TranslatedText text="Blooming 🌸" /> : <TranslatedText text="Growing 🌱" />}
          </span>
        </TiltCard>

        {/* Card 3: Total Impact offsets */}
        <TiltCard className="rounded-xl border border-command-border bg-command-panel p-4 flex flex-col justify-between interactive-card shadow-sm min-h-[90px] text-left">
          <div className="flex justify-between items-center text-xs">
            <span className="text-command-muted font-bold uppercase tracking-wider text-[9px]"><TranslatedText text="Cumulative Impact" /></span>
            <span className="text-[9px] bg-command-accent/10 border border-command-accent/30 text-command-accent px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
              {totalSavings >= 3.0 ? <TranslatedText text="🌿 Eco Champion" /> : <TranslatedText text="🌱 Green Driver" />}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px] font-bold text-gray-800 leading-tight">
            <div className="bg-command-bg/40 p-1.5 rounded border border-command-border/30">
              <span className="block text-command-success text-sm font-extrabold">{totalSavings}kg</span>
              <span className="text-[8px] text-gray-500 font-semibold uppercase"><TranslatedText text="CO₂ Offset" /></span>
            </div>
            <div className="bg-command-bg/40 p-1.5 rounded border border-command-border/30">
              <span className="block text-command-success text-sm font-extrabold">{totalFuelSaved}L</span>
              <span className="text-[8px] text-gray-500 font-semibold uppercase"><TranslatedText text="Fuel Saved" /></span>
            </div>
            <div className="bg-command-bg/40 p-1.5 rounded border border-command-border/30">
              <span className="block text-command-success text-sm font-extrabold">{totalTimeSaved}m</span>
              <span className="text-[8px] text-gray-500 font-semibold uppercase"><TranslatedText text="Time Saved" /></span>
            </div>
          </div>
        </TiltCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Column (lg:col-span-2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-[300px] sm:h-[384px] overflow-hidden rounded-xl border border-command-border interactive-card shadow-sm relative text-left">
            <MapContainer center={BENGALURU_CENTER} zoom={11} style={{ height: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Google Streets">
                  <TileLayer
                    attribution="&copy; Google Maps"
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Google Satellite">
                  <TileLayer
                    attribution="&copy; Google Maps"
                    url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Dark Mode">
                  <TileLayer
                    attribution="&copy; CartoDB"
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              {zones.map((zone) => (
                <CircleMarker
                  key={zone.zone}
                  center={[zone.latitude, zone.longitude]}
                  radius={14}
                  pathOptions={{
                    color: ADVISORY_COLORS[zone.color] || '#486E5D',
                    fillColor: ADVISORY_COLORS[zone.color] || '#486E5D',
                    fillOpacity: 0.5,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <strong>{t(zone.zone)}</strong>
                    <br />
                    <TranslatedText text={zone.advisory} /> — {zone.speed_drop_pct}% <TranslatedText text="slower" />
                    <br />
                    <TranslatedText text={zone.tip} />
                  </Popup>
                </CircleMarker>
              ))}

              {/* Draw polyline routes if calculated */}
              {calculatedRoutes && (
                <>
                  <Polyline 
                    positions={calculatedRoutes.standard} 
                    pathOptions={{ color: '#A33B3B', weight: 5, opacity: 0.8 }}
                  >
                    <Popup><TranslatedText text="Standard Route (More delay)" /></Popup>
                  </Polyline>
                  <Polyline 
                    positions={calculatedRoutes.eco} 
                    pathOptions={{ color: '#4C6E5D', weight: 6, opacity: 0.95, dashArray: '10, 10' }}
                  >
                    <Popup><TranslatedText text="Eco-Smart Route (Fluid & fuel-efficient)" /></Popup>
                  </Polyline>
                  <FitRouteBounds route={calculatedRoutes.eco} />
                </>
              )}
            </MapContainer>
            
            {calculatedRoutes && (
              <div className="absolute bottom-4 left-4 z-[400] bg-white/95 border border-command-border/50 p-2.5 rounded-lg shadow-md flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-800">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-6 inline-block bg-[#A33B3B] rounded" />
                  <span><TranslatedText text="Standard" /></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-6 inline-block bg-[#4C6E5D] border-dashed border border-white rounded" />
                  <span><TranslatedText text="Eco-Smart" /></span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls, Impact Stats & Advisories Column */}
        {/* Controls, Impact Stats & Advisories Column */}
        <div className="space-y-6">
          {/* Trip Planner Control Card */}
          <TiltCard className="rounded-xl border border-command-border bg-command-panel p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-left">
              <span className="text-lg">🧭</span>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider"><TranslatedText text="Eco-Smart Commute" /></h3>
                <p className="text-[10px] text-command-muted font-medium"><TranslatedText text="Bypass congested gridlock and reduce CO2 emissions automatically" /></p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
              <div>
                <label className="text-[10px] font-bold text-command-muted uppercase tracking-wider block mb-1"><TranslatedText text="Start Hub" /></label>
                <select 
                  value={origin} 
                  onChange={(e) => setOrigin(e.target.value)}
                  className="w-full bg-command-bg border border-command-border rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none cursor-pointer"
                >
                  {LOCATIONS.map(l => (
                    <option key={l.name} value={l.name}>{t(l.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-command-muted uppercase tracking-wider block mb-1"><TranslatedText text="End Destination" /></label>
                <select 
                  value={destination} 
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full bg-command-bg border border-command-border rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none cursor-pointer"
                >
                  {LOCATIONS.filter(l => l.name !== origin).map(l => (
                    <option key={l.name} value={l.name}>{t(l.name)}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleCalculateRoute}
              disabled={calculatingRoute}
              className="w-full rounded-xl bg-command-accent text-white py-2.5 text-xs font-semibold hover:opacity-95 active:scale-95 transition-all shadow-md shadow-command-accent/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {calculatingRoute ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="animate-spin text-sm">🔄</span>
                  <TranslatedText text="Computing Real Road Options..." />
                </span>
              ) : (
                <TranslatedText text="Calculate Route Options" />
              )}
            </button>
          </TiltCard>

          {routeSuccessMessage && (
            <div className="rounded-xl border border-command-success bg-command-success/15 p-4 text-xs font-bold text-command-success text-left animate-slideIn">
              {routeSuccessMessage}
            </div>
          )}

          {routeDetails && (
            <div className="rounded-xl border border-command-success/30 bg-command-success/5 p-5 shadow-sm space-y-4 animate-slideIn">
              <div className="flex items-center justify-between border-b border-command-success/20 pb-3 text-left">
                <h3 className="text-xs font-bold text-command-success uppercase tracking-wider"><TranslatedText text="🌱 Eco-Smart Impact" /></h3>
                <span className="text-[9px] bg-command-success text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider"><TranslatedText text="Optimal" /></span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white border border-command-border/40 p-2 rounded-lg">
                  <p className="text-[9px] font-bold text-command-muted uppercase tracking-wider"><TranslatedText text="Time Saved" /></p>
                  <p className="text-base font-extrabold text-command-success mt-0.5">{routeDetails.timeSaved}m</p>
                  <p className="text-[8px] text-gray-400 font-bold">-{routeDetails.timePct}%</p>
                </div>
                <div className="bg-white border border-command-border/40 p-2 rounded-lg">
                  <p className="text-[9px] font-bold text-command-muted uppercase tracking-wider"><TranslatedText text="CO2 Saved" /></p>
                  <p className="text-base font-extrabold text-command-success mt-0.5">{routeDetails.co2Saved}kg</p>
                  <p className="text-[8px] text-gray-400 font-bold">-{routeDetails.co2Pct}%</p>
                </div>
                <div className="bg-white border border-command-border/40 p-2 rounded-lg">
                  <p className="text-[9px] font-bold text-command-muted uppercase tracking-wider"><TranslatedText text="Fuel Saved" /></p>
                  <p className="text-base font-extrabold text-command-success mt-0.5">{routeDetails.fuelSaved}L</p>
                  <p className="text-[8px] text-gray-400 font-bold">-{routeDetails.fuelPct}%</p>
                </div>
              </div>
              
              <div className="text-xs space-y-2 text-gray-700 bg-white/50 p-3 rounded-lg border border-command-border/20 text-left">
                <div className="flex justify-between">
                  <span className="text-command-muted font-medium"><TranslatedText text="Eco Route:" /></span>
                  <span className="font-semibold text-gray-800">{routeDetails.ecoDist} km · {routeDetails.ecoTime}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-command-muted font-medium"><TranslatedText text="Standard Route:" /></span>
                  <span className="font-semibold text-gray-800">{routeDetails.stdDist} km · {routeDetails.stdTime}m</span>
                </div>
                <p className="text-[9px] text-command-accent bg-command-accent/5 p-2 rounded border border-command-accent/15 mt-2 font-medium leading-relaxed text-left">
                  💡 **<TranslatedText text="Bypass Notice" />:** <TranslatedText text="Standard path triggers extra start-stop idling. The eco route bypasses the main intersection, conserving fuel." />
                </p>
              </div>

              <button
                onClick={handleConfirmEcoCommute}
                disabled={recordingCommute}
                className="w-full rounded-xl bg-command-success text-white py-2.5 text-xs font-semibold hover:opacity-95 active:scale-95 transition-all shadow-md shadow-command-success/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {recordingCommute ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="animate-spin text-sm">🌿</span>
                    <TranslatedText text="Logging Commute..." />
                  </span>
                ) : (
                  <TranslatedText text="Confirm & Select Eco-Smart Route" />
                )}
              </button>
            </div>
          )}

          <div className="space-y-3 text-left">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider"><TranslatedText text="Zone Advisories" /></h2>
            {zones.map((zone) => (
              <div
                key={zone.zone}
                className="flex items-start justify-between rounded-xl border border-command-border bg-command-panel p-4 interactive-card shadow-sm"
                style={{ borderLeft: `4px solid ${ADVISORY_COLORS[zone.color] || '#486E5D'}` }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: `${ADVISORY_COLORS[zone.color]}15`,
                        color: ADVISORY_COLORS[zone.color],
                      }}
                    >
                      <TranslatedText text={zone.advisory} />
                    </span>
                    <span className="font-semibold text-gray-800 text-sm">{t(zone.zone)}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed"><TranslatedText text={zone.tip} /></p>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <TranslatedText text="Speed" />: {zone.current_speed_kmh} km/h (<TranslatedText text="normally" /> {zone.baseline_speed_kmh}) ·{' '}
                    {zone.parking_violations_24h} <TranslatedText text="violations (24h)" />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
