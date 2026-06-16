import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const BENGALURU_CENTER = [12.9716, 77.5946];

function FitBounds({ features }) {
  const map = useMap();

  useEffect(() => {
    if (!features?.length) return;
    const lats = features.map((f) => f.geometry.coordinates[1]);
    const lons = features.map((f) => f.geometry.coordinates[0]);
    const bounds = [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ];
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [features, map]);

  return null;
}

function intensityColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  if (score >= 25) return '#eab308';
  return '#3b82f6';
}

export default function HeatMap({ data, zoneIntensity = {}, height = '400px' }) {
  const features = data?.features || [];

  const zoneMarkers = useMemo(
    () =>
      Object.entries(zoneIntensity).map(([zone, meta]) => {
        const zoneFeatures = features.filter((f) => f.properties.zone === zone);
        if (!zoneFeatures.length) return null;
        const avgLat =
          zoneFeatures.reduce((s, f) => s + f.geometry.coordinates[1], 0) / zoneFeatures.length;
        const avgLon =
          zoneFeatures.reduce((s, f) => s + f.geometry.coordinates[0], 0) / zoneFeatures.length;
        return { zone, lat: avgLat, lon: avgLon, ...meta };
      }).filter(Boolean),
    [features, zoneIntensity]
  );

  return (
    <div className="overflow-hidden rounded-xl border border-command-border" style={{ height }}>
      <MapContainer center={BENGALURU_CENTER} zoom={12} scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds features={features} />
        {features.slice(0, 1500).map((feature, idx) => {
          const [lon, lat] = feature.geometry.coordinates;
          const zone = feature.properties.zone;
          const score = zoneIntensity[zone]?.congestion_score || 30;
          return (
            <CircleMarker
              key={feature.properties.id || idx}
              center={[lat, lon]}
              radius={4}
              pathOptions={{
                color: intensityColor(score),
                fillColor: intensityColor(score),
                fillOpacity: 0.6,
                weight: 1,
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{zone}</strong>
                  <br />
                  {feature.properties.vehicle_type}
                  <br />
                  {feature.properties.violation_types?.join(', ')}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
        {zoneMarkers.map((zm) => (
          <CircleMarker
            key={zm.zone}
            center={[zm.lat, zm.lon]}
            radius={18}
            pathOptions={{
              color: intensityColor(zm.congestion_score),
              fillColor: intensityColor(zm.congestion_score),
              fillOpacity: 0.15,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{zm.zone}</strong>
              <br />
              Congestion: {zm.congestion_score}
              <br />
              Level: {zm.level}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
