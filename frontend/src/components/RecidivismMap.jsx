import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const BENGALURU_CENTER = [12.9716, 77.5946];

export default function RecidivismMap({ data }) {
  const zones = data?.zones || [];

  return (
    <div className="rounded-xl border border-command-border bg-command-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Recidivism Heatmap</h3>
          <p className="text-sm text-command-muted">
            {data?.stubborn_zone_count || 0} stubborn zones (&gt;60% recurrence)
          </p>
        </div>
      </div>

      <div className="mt-4 h-64 overflow-hidden rounded-lg">
        <MapContainer center={BENGALURU_CENTER} zoom={11} scrollWheelZoom={false} style={{ height: '100%' }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          {zones.map((zone) => (
            <CircleMarker
              key={zone.zone}
              center={[zone.latitude, zone.longitude]}
              radius={12 + zone.recurrence_rate * 30}
              pathOptions={{
                color: zone.is_stubborn_zone ? '#ef4444' : '#f59e0b',
                fillColor: zone.is_stubborn_zone ? '#ef4444' : '#f59e0b',
                fillOpacity: 0.4,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{zone.zone}</strong>
                <br />
                Recurrence: {(zone.recurrence_rate * 100).toFixed(1)}%
                <br />
                {zone.is_stubborn_zone ? 'STUBBORN ZONE' : 'Monitor'}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
        {zones.map((zone) => (
          <div
            key={zone.zone}
            className={`rounded-lg border px-3 py-2 text-sm ${
              zone.is_stubborn_zone
                ? 'border-command-danger/30 bg-command-danger/5'
                : 'border-command-border bg-command-bg'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">{zone.zone}</span>
              <span className="text-xs text-gray-400">{(zone.recurrence_rate * 100).toFixed(1)}%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{zone.recommendation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
