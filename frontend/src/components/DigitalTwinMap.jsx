import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const BENGALURU_CENTER = [77.6100, 12.9550]; // [lng, lat]

// All 16 zones matching backend BENGALURU_ZONES
const ZONE_COORDS = {
  "Koramangala":      { center: [77.6245, 12.9352] },
  "HSR Layout":       { center: [77.6473, 12.9116] },
  "Indiranagar":      { center: [77.6408, 12.9784] },
  "MG Road":          { center: [77.6063, 12.9750] },
  "Silk Board":       { center: [77.6225, 12.9177] },
  "Whitefield":       { center: [77.7500, 12.9698] },
  "Majestic":         { center: [77.5712, 12.9766] },
  "Hebbal":           { center: [77.5978, 13.0358] },
  "Electronic City":  { center: [77.6602, 12.8452] },
  "Jayanagar":        { center: [77.5824, 12.9284] },
  "Yelahanka":        { center: [77.5862, 13.0978] },
  "Marathahalli":     { center: [77.6974, 12.9592] },
  "Malleshwaram":     { center: [77.5720, 12.9984] },
  "Banashankari":     { center: [77.5736, 12.9156] },
  "BTM Layout":       { center: [77.6083, 12.9166] },
  "Rajajinagar":      { center: [77.5562, 12.9892] },
};

// Realistic mock congestion scores — guarantees Green + Orange + Red on the map
const MOCK_CONGESTION = {
  "Silk Board": 85,
  "MG Road": 72,
  "Majestic": 78,
  "Whitefield": 65,
  "Marathahalli": 62,
  "Koramangala": 55,
  "Indiranagar": 48,
  "BTM Layout": 45,
  "Hebbal": 42,
  "HSR Layout": 35,
  "Rajajinagar": 30,
  "Electronic City": 28,
  "Malleshwaram": 25,
  "Jayanagar": 22,
  "Banashankari": 20,
  "Yelahanka": 15,
};

// ~20 realistic traffic corridors connecting the 16 zones
const CORRIDORS = [
  // Outer Ring Road (ORR) belt
  { from: "Silk Board", to: "BTM Layout" },
  { from: "BTM Layout", to: "Koramangala" },
  { from: "Koramangala", to: "Indiranagar" },
  { from: "Indiranagar", to: "Marathahalli" },
  { from: "Marathahalli", to: "Whitefield" },
  // Inner city connections
  { from: "Majestic", to: "MG Road" },
  { from: "MG Road", to: "Indiranagar" },
  { from: "Majestic", to: "Rajajinagar" },
  { from: "Rajajinagar", to: "Malleshwaram" },
  { from: "Malleshwaram", to: "Hebbal" },
  { from: "Hebbal", to: "Yelahanka" },
  // South connections
  { from: "Jayanagar", to: "Banashankari" },
  { from: "Jayanagar", to: "BTM Layout" },
  { from: "Silk Board", to: "HSR Layout" },
  { from: "HSR Layout", to: "Electronic City" },
  { from: "HSR Layout", to: "Koramangala" },
  // Cross-city links
  { from: "Majestic", to: "Jayanagar" },
  { from: "Malleshwaram", to: "Majestic" },
  { from: "Koramangala", to: "MG Road" },
  { from: "Silk Board", to: "Electronic City" },
];

function getTrafficColor(score) {
  if (score >= 60) return '#EF4444'; // Red
  if (score >= 30) return '#F59E0B'; // Orange
  return '#10B981'; // Green
}

function getScore(zone, zoneIntensity) {
  return zoneIntensity[zone]?.congestion_score ?? MOCK_CONGESTION[zone] ?? 30;
}

export default function DigitalTwinMap({ data, zoneIntensity = {}, className = 'h-[400px] md:h-[500px]' }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const animationRef = useRef(null);

  const [isOrbiting, setIsOrbiting] = useState(true);
  const [show3dBuildings, setShow3dBuildings] = useState(true);
  const [showTrafficFlow, setShowTrafficFlow] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const features = data?.features || [];

  // 1. Initialize Map (runs once)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: BENGALURU_CENTER,
      zoom: 11.2,
      pitch: 55,
      bearing: -15,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // --- Violation points as canvas circle layer (NO DOM markers!) ---
      map.addSource('violation-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'violation-circles',
        type: 'circle',
        source: 'violation-points',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            9, 2.5,
            12, 5,
            15, 8,
          ],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.2,
          'circle-stroke-opacity': 0.6,
        },
      });

      // --- Popup on click for violation circles ---
      map.on('click', 'violation-circles', (e) => {
        const props = e.features[0].properties;
        const coords = e.features[0].geometry.coordinates.slice();
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(coords)
          .setHTML(`
            <div style="padding:10px;color:#e2e8f0;font-family:Inter,sans-serif;font-size:11px;background:rgba(2,6,23,0.95);border-radius:10px;border:1px solid #334155;min-width:150px;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;padding-bottom:6px;margin-bottom:6px;">
                <strong style="font-size:13px;color:#f1f5f9;">${props.zone || 'Unknown'}</strong>
                <span style="background:${props.color};color:#0f172a;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:900;">${props.score}%</span>
              </div>
              <div style="color:#94a3b8;">
                <div><strong style="color:#cbd5e1;">Violation:</strong> ${props.violation_types || 'Parking'}</div>
                <div><strong style="color:#cbd5e1;">Vehicle:</strong> ${props.vehicle_type || 'Unknown'}</div>
              </div>
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'violation-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'violation-circles', () => { map.getCanvas().style.cursor = ''; });

      // --- 3D Zone blocks ---
      map.addSource('traffic-zones', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'zones-3d',
        type: 'fill-extrusion',
        source: 'traffic-zones',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.75,
        },
      });

      // --- Zone labels ---
      map.addSource('zone-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'zone-label-text',
        type: 'symbol',
        source: 'zone-labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-offset': [0, -2.5],
          'text-anchor': 'center',
          'text-font': ['Open Sans Bold'],
        },
        paint: {
          'text-color': '#e2e8f0',
          'text-halo-color': '#0f172a',
          'text-halo-width': 2,
        },
      });

      // --- Corridor lines ---
      map.addSource('traffic-corridors', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'corridors-lines',
        type: 'line',
        source: 'traffic-corridors',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-blur': 1.5,
          'line-opacity': 0.75,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // --- Vehicle flow particles ---
      startVehicleSimulation(map);
      setMapLoaded(true);
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      map.remove();
    };
  }, []);

  // 2. Update ALL layers when data or zoneIntensity changes (flicker-free!)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // --- A) Violation points circle layer ---
    const maxPoints = 200;
    const step = Math.max(1, Math.floor(features.length / maxPoints));
    const sampledFeatures = [];
    for (let i = 0; i < features.length; i += step) {
      sampledFeatures.push(features[i]);
      if (sampledFeatures.length >= maxPoints) break;
    }

    const circleFeatures = sampledFeatures.map((feature) => {
      const zone = feature.properties.zone;
      const score = getScore(zone, zoneIntensity);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          color: getTrafficColor(score),
          score,
          violation_types: feature.properties.violation_types?.join?.(', ') || feature.properties.violation_types || 'Parking',
        },
      };
    });

    const violationSource = map.getSource('violation-points');
    if (violationSource) {
      violationSource.setData({ type: 'FeatureCollection', features: circleFeatures });
    }

    // --- B) 3D Zone extrusion blocks ---
    const zoneFeatures = Object.entries(ZONE_COORDS).map(([name, config]) => {
      const score = getScore(name, zoneIntensity);
      const height = Math.max(150, score * 18);
      const center = config.center;
      const r = 0.004;
      const coords = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        coords.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)]);
      }
      coords.push(coords[0]);

      return {
        type: 'Feature',
        properties: { name, height, score, color: getTrafficColor(score) },
        geometry: { type: 'Polygon', coordinates: [coords] },
      };
    });

    const zoneSource = map.getSource('traffic-zones');
    if (zoneSource) {
      zoneSource.setData({ type: 'FeatureCollection', features: zoneFeatures });
    }

    // --- C) Zone labels ---
    const labelFeatures = Object.entries(ZONE_COORDS).map(([name, config]) => ({
      type: 'Feature',
      properties: { name },
      geometry: { type: 'Point', coordinates: config.center },
    }));

    const labelSource = map.getSource('zone-labels');
    if (labelSource) {
      labelSource.setData({ type: 'FeatureCollection', features: labelFeatures });
    }

    // --- D) Corridor road route lines ---
    const corridorFeatures = CORRIDORS.map((corridor) => {
      const from = ZONE_COORDS[corridor.from].center;
      const to = ZONE_COORDS[corridor.to].center;
      const fromScore = getScore(corridor.from, zoneIntensity);
      const toScore = getScore(corridor.to, zoneIntensity);
      const avgScore = (fromScore + toScore) / 2;

      return {
        type: 'Feature',
        properties: { color: getTrafficColor(avgScore) },
        geometry: { type: 'LineString', coordinates: [from, to] },
      };
    });

    const corridorSource = map.getSource('traffic-corridors');
    if (corridorSource) {
      corridorSource.setData({ type: 'FeatureCollection', features: corridorFeatures });
    }
  }, [features, zoneIntensity, mapLoaded]);

  // 3. Vehicle flow animation (slow, cinematic)
  const startVehicleSimulation = (map) => {
    const particles = [];
    const numParticles = 60;

    for (let i = 0; i < numParticles; i++) {
      const corridor = CORRIDORS[i % CORRIDORS.length];
      particles.push({
        corridor,
        progress: Math.random(),
        speed: 0.0008 + Math.random() * 0.0012,
      });
    }

    map.addSource('vehicles', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    map.addLayer({
      id: 'vehicles-points',
      type: 'circle',
      source: 'vehicles',
      paint: {
        'circle-radius': 4,
        'circle-color': '#FFFFFF',
        'circle-stroke-color': '#F59E0B',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.9,
      },
    });

    const animate = () => {
      if (!mapRef.current) return;

      const vehicleFeatures = particles.map((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          p.corridor = CORRIDORS[Math.floor(Math.random() * CORRIDORS.length)];
        }

        const from = ZONE_COORDS[p.corridor.from].center;
        const to = ZONE_COORDS[p.corridor.to].center;
        const lng = from[0] + (to[0] - from[0]) * p.progress;
        const lat = from[1] + (to[1] - from[1]) * p.progress;

        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
        };
      });

      const source = map.getSource('vehicles');
      if (source) {
        source.setData({ type: 'FeatureCollection', features: vehicleFeatures });
      }

      // Slow cinematic camera orbit
      if (isOrbiting) {
        const bearing = map.getBearing();
        map.setBearing((bearing + 0.02) % 360);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  // 4. Layer visibility toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer('zones-3d')) {
      map.setLayoutProperty('zones-3d', 'visibility', show3dBuildings ? 'visible' : 'none');
    }
  }, [show3dBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer('vehicles-points')) {
      map.setLayoutProperty('vehicles-points', 'visibility', showTrafficFlow ? 'visible' : 'none');
    }
  }, [showTrafficFlow]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#2B3E4A]/80 shadow-2xl bg-slate-950 font-sans">
      {/* Custom popup styles */}
      <style>{`
        .maplibregl-popup-content {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          border: none !important;
        }
        .maplibregl-popup-tip {
          border-top-color: rgba(2, 6, 23, 0.95) !important;
        }
      `}</style>

      {/* 3D Map Container */}
      <div ref={mapContainerRef} className={className} style={{ width: '100%' }} />

      {/* Control Overlay Panels */}
      <div className="absolute bottom-4 left-4 z-10 p-3 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md text-xs text-slate-200 shadow-xl flex flex-col gap-2.5">
        <div className="font-semibold text-slate-100 text-xs tracking-wide uppercase border-b border-slate-800 pb-1.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Digital Twin Console
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={show3dBuildings} 
            onChange={(e) => setShow3dBuildings(e.target.checked)}
            className="accent-amber-500 cursor-pointer h-3.5 w-3.5"
          />
          Show 3D Zones
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={showTrafficFlow} 
            onChange={(e) => setShowTrafficFlow(e.target.checked)}
            className="accent-amber-500 cursor-pointer h-3.5 w-3.5"
          />
          Show Traffic Flow
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input 
            type="checkbox" 
            checked={isOrbiting} 
            onChange={(e) => setIsOrbiting(e.target.checked)}
            className="accent-amber-500 cursor-pointer h-3.5 w-3.5"
          />
          Camera Orbit Mode
        </label>
      </div>

      {/* Legend overlay */}
      <div className="absolute top-4 left-4 z-10 p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 backdrop-blur-md text-[10px] text-slate-300 shadow-xl flex flex-col gap-1.5">
        <div className="font-semibold text-slate-200">Traffic Density Legend</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Normal Flow
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500"></span> Slow/Moderate
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span> High Congestion
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-amber-400"></span> Vehicle Flow
        </div>
      </div>
    </div>
  );
}
