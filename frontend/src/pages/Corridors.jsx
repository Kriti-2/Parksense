import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import CorridorStatus from '../components/CorridorStatus';
import RecidivismMap from '../components/RecidivismMap';

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

  useEffect(() => {
    Promise.all([api.getCorridors(), api.getRecidivism()]).then(([co, re]) => {
      setCorridors(co.data);
      setRecidivism(re.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-center text-gray-400">Loading corridor data...</div>;
  }

  const corridorList = corridors?.corridors || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Green Corridor Protector</h2>
        <p className="mt-1 text-sm text-command-muted">
          Monitor emergency routes — MG Road, Silk Board, Whitefield corridors
        </p>
      </div>

      <div className="h-96 overflow-hidden rounded-xl border border-command-border">
        <MapContainer center={BENGALURU_CENTER} zoom={12} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {corridorList.map((corridor) => {
            const coords = corridor.waypoints?.map(([lat, lon]) => [lat, lon]) || [];
            return (
              <Polyline
                key={corridor.id}
                positions={coords}
                pathOptions={{
                  color: corridorColors[corridor.status] || '#3b82f6',
                  weight: 5,
                  opacity: 0.8,
                }}
              >
                <Popup>
                  <strong>{corridor.name}</strong>
                  <br />
                  Status: {corridor.status}
                </Popup>
              </Polyline>
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
