import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import CorridorStatus from '../components/CorridorStatus';
import RecidivismMap from '../components/RecidivismMap';
import LiveStatusBar from '../components/LiveStatusBar';

const BENGALURU_CENTER = [12.9716, 77.5946];

const corridorColors = {
  CLEAR: '#10b981',
  CAUTION: '#f59e0b',
  DEGRADED: '#f97316',
  BLOCKED: '#ef4444',
};

export default function Corridors() {
  const [corridors, setCorridors] = useState(null);
  const [recidivism, setRecidivism] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(null);
  const [routesData, setRoutesData] = useState({});

  const handleLiveTick = useCallback((payload) => {
    if (payload.type !== 'live_tick') return;
    setLastTick(payload);

    if (payload.corridors) {
      setCorridors(payload.corridors);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    Promise.all([api.getCorridors(), api.getRecidivism()]).then(([co, re]) => {
      setCorridors(co.data);
      setRecidivism(re.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!corridors?.corridors) return;

    corridors.corridors.forEach((corridor) => {
      if (routesData[corridor.id]) return;

      const routeCoords = corridor.waypoints?.map(([lat, lon]) => `${lon},${lat}`).join(';');
      if (!routeCoords) return;

      const url = `https://router.project-osrm.org/route/v1/driving/${routeCoords}?overview=full&geometries=geojson&alternatives=true`;
      
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.routes && data.routes.length > 0) {
            const primaryRoute = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            let alternativeRoute = null;
            if (data.routes.length > 1) {
              alternativeRoute = data.routes[1].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
            }
            setRoutesData((prev) => ({
              ...prev,
              [corridor.id]: {
                primary: primaryRoute,
                alternative: alternativeRoute,
              },
            }));
          }
        })
        .catch((err) => console.error(`Failed to fetch route for corridor ${corridor.id}:`, err));
    });
  }, [corridors, routesData]);

  if (loading) {
    return <div className="text-center text-gray-400">Loading corridor data...</div>;
  }

  const corridorList = corridors?.corridors || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Green Corridor Protector</h2>
          <p className="mt-1 text-sm text-command-muted">
            Monitor emergency routes — MG Road, Silk Board, Whitefield corridors
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      <div className="h-96 overflow-hidden rounded-xl border border-command-border">
        <MapContainer center={BENGALURU_CENTER} zoom={12} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {corridorList.map((corridor) => {
            const route = routesData[corridor.id];
            const primaryCoords = route?.primary || corridor.waypoints || [];
            const alternativeCoords = route?.alternative;

            return (
              <div key={corridor.id}>
                {/* Primary Route */}
                <Polyline
                  positions={primaryCoords}
                  pathOptions={{
                    color: corridorColors[corridor.status] || '#3b82f6',
                    weight: corridor.status === 'BLOCKED' ? 6 : 5,
                    opacity: 0.85,
                    dashArray: corridor.status === 'BLOCKED' ? '5, 8' : undefined,
                  }}
                >
                  <Popup>
                    <div className="text-sm font-semibold text-white">
                      {corridor.name}
                    </div>
                    <div className="text-xs mt-1 text-gray-300">
                      Status: <span className="font-bold" style={{ color: corridorColors[corridor.status] }}>{corridor.status}</span>
                    </div>
                    {corridor.status === 'BLOCKED' && (
                      <div className="text-xs mt-1 text-command-success font-semibold">
                        ⚠️ Alternative route calculated and suggested (green).
                      </div>
                    )}
                  </Popup>
                </Polyline>

                {/* Alternative Route (if primary is blocked) */}
                {corridor.status === 'BLOCKED' && alternativeCoords && (
                  <Polyline
                    positions={alternativeCoords}
                    pathOptions={{
                      color: '#10b981',
                      weight: 5,
                      opacity: 0.9,
                      dashArray: '10, 8',
                    }}
                  >
                    <Popup>
                      <div className="text-sm font-semibold text-white">
                        Suggested Alternative Corridor Route
                      </div>
                      <div className="text-xs mt-1 text-command-success font-semibold">
                        Bypasses blocked bottlenecks on {corridor.name}
                      </div>
                    </Popup>
                  </Polyline>
                )}
              </div>
            );
          })}
          {corridorList.map((corridor) =>
            corridor.waypoints?.map((wp, i) => (
              <CircleMarker
                key={`${corridor.id}-${i}`}
                center={wp}
                radius={6}
                pathOptions={{
                  color: corridorColors[corridor.status],
                  fillColor: corridorColors[corridor.status],
                  fillOpacity: 0.8,
                }}
              />
            ))
          )}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CorridorStatus data={corridors} />
        <RecidivismMap data={recidivism} />
      </div>
    </div>
  );
}
