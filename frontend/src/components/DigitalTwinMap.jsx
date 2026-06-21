import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const BENGALURU_CENTER = [77.5946, 12.9716]; // [lng, lat]

// Zone geographic coordinates for 3D blocks
const ZONE_COORDS = {
  "Silk Board": { center: [77.5824, 12.9284], color: '#A33B3B' },
  "MG Road": { center: [77.6063, 12.9750], color: '#C0613F' },
  "Koramangala": { center: [77.6245, 12.9352], color: '#3D5A4A' },
  "HSR Layout": { center: [77.6473, 12.9116], color: '#4C6E5D' },
  "Indiranagar": { center: [77.6408, 12.9784], color: '#3D5A4A' },
  "Whitefield": { center: [77.7500, 12.9698], color: '#4C6E5D' },
};

// Major traffic corridors between zones for flow animation
const CORRIDORS = [
  { from: "Silk Board", to: "Koramangala" },
  { from: "Koramangala", to: "MG Road" },
  { from: "MG Road", to: "Indiranagar" },
  { from: "Indiranagar", to: "Whitefield" },
  { from: "Silk Board", to: "HSR Layout" },
  { from: "HSR Layout", to: "Koramangala" },
];

function getTrafficColor(score) {
  if (score >= 75) return '#EF4444'; // Red
  if (score >= 50) return '#F59E0B'; // Yellow/Amber
  return '#10B981'; // Green
}

export default function DigitalTwinMap({ data, zoneIntensity = {}, className = 'h-[400px] md:h-[500px]' }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const animationRef = useRef(null);
  const markersRef = useRef([]);

  const [isOrbiting, setIsOrbiting] = useState(true);
  const [show3dBuildings, setShow3dBuildings] = useState(true);
  const [showTrafficFlow, setShowTrafficFlow] = useState(true);

  const features = data?.features || [];

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use CartoDB Dark Matter style which is free and dark
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: BENGALURU_CENTER,
      zoom: 11.5,
      pitch: 55,
      bearing: -15,
      antialias: true,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Add custom styles for 3D extrusion of traffic zones
      setupTrafficLayers(map);
      startVehicleSimulation(map);
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      markersRef.current.forEach(m => m.remove());
      map.remove();
    };
  }, []);

  // 2. Update Hotspot Blinking Markers when data/violations change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Filter features to get active violation points
    features.forEach((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const zone = feature.properties.zone;
      const score = zoneIntensity[zone]?.congestion_score || 30;

      // Create a premium blinking DOM element for the hotspot marker
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center';
      el.style.width = '24px';
      el.style.height = '24px';

      // Inner blinking core
      const pulse = document.createElement('div');
      pulse.className = 'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping';
      pulse.style.backgroundColor = score >= 50 ? '#EF4444' : '#F59E0B';
      
      const core = document.createElement('div');
      core.className = 'relative inline-flex rounded-full h-3 w-3 shadow-lg';
      core.style.backgroundColor = score >= 50 ? '#EF4444' : '#F59E0B';

      el.appendChild(pulse);
      el.appendChild(core);

      // Tooltip/Popup info
      const popup = new maplibregl.Popup({ offset: 12 }).setHTML(`
        <div class="p-2 text-slate-100 font-sans text-xs bg-slate-900/90 rounded border border-slate-700">
          <strong class="text-sm text-amber-400">${zone || 'Unknown Zone'}</strong><br/>
          <strong>Violation:</strong> ${feature.properties.violation_types?.join(', ') || 'Parking'}<br/>
          <strong>Vehicle:</strong> ${feature.properties.vehicle_type || 'Unknown'}<br/>
          <strong>Risk Score:</strong> ${score}
        </div>
      `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lon, lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [features, zoneIntensity]);

  // 3. Setup Traffic and 3D Zone Layers
  const setupTrafficLayers = (map) => {
    // Generate Zone 3D cylinder blocks
    const zoneFeatures = Object.entries(ZONE_COORDS).map(([name, config]) => {
      const score = zoneIntensity[name]?.congestion_score || 35;
      const height = score * 15; // Extrusion height scale

      // Generate a small polygon hex block around the center
      const center = config.center;
      const r = 0.005; // radius in degrees
      const coords = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        coords.push([center[0] + r * Math.cos(angle), center[1] + r * Math.sin(angle)]);
      }
      coords.push(coords[0]); // Close polygon

      return {
        type: 'Feature',
        properties: {
          name,
          height: height,
          base_height: 0,
          score: score,
          color: getTrafficColor(score),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      };
    });

    map.addSource('traffic-zones', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: zoneFeatures },
    });

    // Add 3D Extrusion layer for Traffic Zones
    map.addLayer({
      id: 'zones-3d',
      type: 'fill-extrusion',
      source: 'traffic-zones',
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': ['get', 'base_height'],
        'fill-extrusion-opacity': 0.75,
      },
    });

    // Add Corridor lines between Zones
    const corridorFeatures = CORRIDORS.map((corridor) => {
      const from = ZONE_COORDS[corridor.from].center;
      const to = ZONE_COORDS[corridor.to].center;
      const fromScore = zoneIntensity[corridor.from]?.congestion_score || 30;
      const toScore = zoneIntensity[corridor.to]?.congestion_score || 30;
      const avgScore = (fromScore + toScore) / 2;

      return {
        type: 'Feature',
        properties: {
          color: getTrafficColor(avgScore),
        },
        geometry: {
          type: 'LineString',
          coordinates: [from, to],
        },
      };
    });

    map.addSource('traffic-corridors', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: corridorFeatures },
    });

    map.addLayer({
      id: 'corridors-lines',
      type: 'line',
      source: 'traffic-corridors',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-blur': 2,
        'line-opacity': 0.8,
      },
    });
  };

  // 4. Vehicle flow animation loop
  const startVehicleSimulation = (map) => {
    // Generate particle positions along corridors
    const particles = [];
    const numParticles = 45;

    for (let i = 0; i < numParticles; i++) {
      const corridor = CORRIDORS[i % CORRIDORS.length];
      particles.push({
        corridor,
        progress: Math.random(), // 0 to 1
        speed: 0.005 + Math.random() * 0.008,
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
        'circle-radius': 4.5,
        'circle-color': '#FFFFFF',
        'circle-stroke-color': '#F59E0B',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95,
      },
    });

    const animate = () => {
      if (!mapRef.current) return;

      // Update particle progress
      const vehicleFeatures = particles.map((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          p.progress = 0;
          // Assign to a random corridor to spice up path flows
          p.corridor = CORRIDORS[Math.floor(Math.random() * CORRIDORS.length)];
        }

        const from = ZONE_COORDS[p.corridor.from].center;
        const to = ZONE_COORDS[p.corridor.to].center;

        // Linear interpolation between the two points
        const lng = from[0] + (to[0] - from[0]) * p.progress;
        const lat = from[1] + (to[1] - from[1]) * p.progress;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
        };
      });

      const source = map.getSource('vehicles');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: vehicleFeatures,
        });
      }

      // 5. Rotate Camera (Orbit mode)
      if (isOrbiting) {
        const bearing = map.getBearing();
        map.setBearing((bearing + 0.08) % 360);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  // 6. Layer visibility triggers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Toggle 3D zone block extrusion
    if (map.getLayer('zones-3d')) {
      map.setLayoutProperty('zones-3d', 'visibility', show3dBuildings ? 'visible' : 'none');
    }
  }, [show3dBuildings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Toggle Vehicle flows
    if (map.getLayer('vehicles-points')) {
      map.setLayoutProperty('vehicles-points', 'visibility', showTrafficFlow ? 'visible' : 'none');
    }
  }, [showTrafficFlow]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#2B3E4A]/80 shadow-2xl bg-slate-950 font-sans">
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
          <span className="w-3 h-3 rounded bg-emerald-500"></span> Normal Flow
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500"></span> Slow/Moderate
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500"></span> High Congestion
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span> Violation Hotspot
        </div>
      </div>
    </div>
  );
}
