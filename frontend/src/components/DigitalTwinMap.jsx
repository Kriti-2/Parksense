import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const BENGALURU_CENTER = [77.5946, 12.9716]; // [lng, lat] for MapLibre

// Helper to generate a small square polygon around a point for 3D extrusion
function getPillarPolygon(lng, lat, size = 0.002) {
  return [
    [
      [lng - size, lat - size],
      [lng + size, lat - size],
      [lng + size, lat + size],
      [lng - size, lat + size],
      [lng - size, lat - size]
    ]
  ];
}

// Interpolate point along a line path at a given progress (0 to 1)
function interpolateRoute(coords, progress) {
  if (!coords || coords.length === 0) return [0, 0];
  if (coords.length === 1) return coords[0];
  if (progress <= 0) return coords[0];
  if (progress >= 1) return coords[coords.length - 1];

  const totalSegments = coords.length - 1;
  const targetSegment = progress * totalSegments;
  const index = Math.floor(targetSegment);
  const segmentProgress = targetSegment - index;

  if (index >= totalSegments) return coords[coords.length - 1];

  const start = coords[index];
  const end = coords[index + 1];

  const lng = start[0] + (end[0] - start[0]) * segmentProgress;
  const lat = start[1] + (end[1] - start[1]) * segmentProgress;

  return [lng, lat];
}

export default function DigitalTwinMap({ 
  zoneIntensity = {}, 
  trafficData = null, 
  violationsData = [], 
  className = 'h-[500px] md:h-[600px] w-full' 
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [flyoverActive, setFlyoverActive] = useState(false);
  const flyoverAnimRef = useRef(null);

  // Layer toggles
  const [showPillars, setShowPillars] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);

  // Optimizations & visual categorization controls
  const [trafficMode, setTrafficMode] = useState('particles'); // 'particles', 'trails', or 'static'
  const [legendTab, setLegendTab] = useState('congestion'); // 'congestion' or 'violations'
  const vehiclesRef = useRef([]);

  // Initialize MapLibre Map
  useEffect(() => {
    if (mapRef.current) return;

    // Create shared popup instance for tooltips
    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'twin-tooltip-popup'
    });

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: BENGALURU_CENTER,
      zoom: 12,
      pitch: 55,
      bearing: -15,
      maxZoom: 18,
      minZoom: 10
    });

    mapRef.current = map;

    map.on('load', () => {
      setIsLoaded(true);

      // Add 3D buildings layer
      map.addLayer({
        'id': '3d-buildings',
        'source': 'openmaptiles',
        'source-layer': 'building',
        'type': 'fill-extrusion',
        'minzoom': 11,
        'paint': {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'render_height'],
            0, '#2b2b35',
            50, '#3a3a4c',
            100, '#4e4e66'
          ],
          'fill-extrusion-height': ['get', 'render_height'],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.75
        }
      });

      // Initialize dynamic sources/layers
      // 1. 3D Hotspot Pillars
      map.addSource('hotspot-pillars', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'hotspot-pillars-layer',
        source: 'hotspot-pillars',
        type: 'fill-extrusion',
        paint: {
          'fill-extrusion-color': ['get', 'color'],
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.85
        }
      });

      // 2. Traffic Flow Lines
      map.addSource('traffic-flows', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'traffic-flows-layer',
        source: 'traffic-flows',
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5.5,
          'line-opacity': 0.85,
          'line-dasharray': [4, 4] // Dashed by default for vehicle flow look
        }
      });

      // 3. Individual Incident Points
      map.addSource('incident-points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'incident-points-layer',
        source: 'incident-points',
        type: 'circle',
        paint: {
          'circle-radius': 2.0,
          'circle-color': ['get', 'incident_color'],
          'circle-stroke-width': 1.0,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.85,
          'circle-stroke-opacity': 0.95
        }
      });

      // 4. Moving Traffic Vehicles
      map.addSource('traffic-vehicles', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'traffic-vehicles-layer',
        source: 'traffic-vehicles',
        type: 'circle',
        paint: {
          'circle-radius': 4.5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.95
        }
      });

      // Interactivity: Hover Tooltips for 3D Pillars
      map.on('mouseenter', 'hotspot-pillars-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        
        const properties = e.features[0].properties;
        const coordinates = e.lngLat;
        const zone = properties.zone;
        const score = properties.congestion_score;
        
        let level = 'CLEAR';
        if (score >= 75) level = 'CRITICAL';
        else if (score >= 50) level = 'HEAVY';
        else if (score >= 25) level = 'MODERATE';

        const colorClass = score >= 75 ? 'text-red-400' : score >= 50 ? 'text-orange-400' : 'text-emerald-405';

        const html = `
          <div style="padding: 10px; background-color: #111827; color: #ffffff; border-radius: 8px; border: 1px solid #374151; font-size: 11px; font-family: sans-serif; line-height: 1.4; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <strong style="font-size: 12px; display: block; border-bottom: 1px solid #374151; padding-bottom: 4px; margin-bottom: 6px; color: #BA5A5A;">${zone} Zone</strong>
            <div>Congestion: <span style="font-weight: bold; color: #f97316;">${score}%</span></div>
            <div>Risk Level: <span style="font-weight: bold;" class="${colorClass}">${level}</span></div>
          </div>
        `;

        popupRef.current
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseleave', 'hotspot-pillars-layer', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current.remove();
      });

      // Interactivity: Hover Tooltips for Incident Points
      map.on('mouseenter', 'incident-points-layer', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        
        const properties = e.features[0].properties;
        const coordinates = e.features[0].geometry.coordinates.slice();
        
        const vehicle = properties.vehicle_type || 'VEHICLE';
        let violations = properties.violation_types || properties.violation_type || 'NO PARKING';
        if (Array.isArray(violations)) {
          violations = violations.join(', ');
        } else if (typeof violations === 'string' && (violations.startsWith('[') || violations.startsWith('{'))) {
          try {
            violations = JSON.parse(violations).join(', ');
          } catch {
            // Keep original string if parsing fails
          }
        }
        const zone = properties.zone || 'Bengaluru';

        const html = `
          <div style="padding: 10px; background-color: #111827; color: #ffffff; border-radius: 8px; border: 1px solid #374151; font-size: 11px; font-family: sans-serif; line-height: 1.4; max-width: 200px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
            <strong style="font-size: 9px; text-transform: uppercase; color: #F39C12; display: block; margin-bottom: 2px;">${vehicle} Violation</strong>
            <div style="font-weight: bold; margin-bottom: 4px; color: #ffffff;">${violations}</div>
            <div style="font-size: 9px; color: #9CA3AF;">Zone: ${zone}</div>
          </div>
        `;

        // Adjust coordinates for popup overlap
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        popupRef.current
          .setLngLat(coordinates)
          .setHTML(html)
          .addTo(map);
      });

      map.on('mouseleave', 'incident-points-layer', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current.remove();
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Layer Visibility on toggle change
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('hotspot-pillars-layer')) {
      mapRef.current.setLayoutProperty('hotspot-pillars-layer', 'visibility', showPillars ? 'visible' : 'none');
    }
  }, [showPillars, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('traffic-flows-layer')) {
      mapRef.current.setLayoutProperty('traffic-flows-layer', 'visibility', showTraffic ? 'visible' : 'none');
    }
  }, [showTraffic, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('incident-points-layer')) {
      mapRef.current.setLayoutProperty('incident-points-layer', 'visibility', showIncidents ? 'visible' : 'none');
    }
  }, [showIncidents, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('3d-buildings')) {
      mapRef.current.setLayoutProperty('3d-buildings', 'visibility', showBuildings ? 'visible' : 'none');
    }
  }, [showBuildings, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('traffic-vehicles-layer')) {
      const visible = showTraffic && trafficMode === 'particles';
      mapRef.current.setLayoutProperty('traffic-vehicles-layer', 'visibility', visible ? 'visible' : 'none');
    }
  }, [showTraffic, trafficMode, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (mapRef.current.getLayer('traffic-flows-layer')) {
      if (trafficMode === 'static') {
        mapRef.current.setPaintProperty('traffic-flows-layer', 'line-dasharray', [4, 4]);
      } else if (trafficMode === 'particles') {
        mapRef.current.setPaintProperty('traffic-flows-layer', 'line-dasharray', [1, 0]);
      }
    }
  }, [trafficMode, isLoaded]);

  // Update Traffic Flow Lines
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficData) {
      mapRef.current.getSource('traffic-flows').setData(trafficData);
    }
  }, [trafficData, isLoaded]);

  // Initialize vehicle particle positions when traffic data changes
  useEffect(() => {
    if (!trafficData || !trafficData.features) return;
    
    const initialVehicles = [];
    trafficData.features.forEach((route, routeIdx) => {
      const coords = route.geometry.coordinates;
      if (!coords || coords.length < 2) return;
      
      const speed = route.properties.current_speed_kmh || 20;
      const color = route.properties.color || '#34C759';
      
      // Spawn 3 vehicles per route staggered at different starting offsets
      const numVehicles = 3;
      for (let i = 0; i < numVehicles; i++) {
        initialVehicles.push({
          routeIdx,
          coords,
          progress: i / numVehicles,
          speedFactor: (speed / 60) * 0.003 + 0.001,
          color: color
        });
      }
    });
    
    vehiclesRef.current = initialVehicles;
  }, [trafficData]);

  // Animate traffic line dash offset (scroll/movement effect) - Throttled for performance
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficMode !== 'trails') return;

    let animFrame;
    let step = 0;
    let lastTime = performance.now();

    const animate = (time) => {
      if (!mapRef.current) return;
      
      // Throttle update to ~15 FPS (~66ms) to avoid CPU lag
      const elapsed = time - lastTime;
      if (elapsed >= 66) {
        lastTime = time;
        step = (step + 0.5) % 12;
        
        if (mapRef.current.getLayer('traffic-flows-layer') && showTraffic) {
          mapRef.current.setPaintProperty('traffic-flows-layer', 'line-dasharray', [
            Math.max(0.1, 4 - step),
            step,
            Math.max(0.1, step),
            12 - step
          ]);
        }
      }
      
      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [isLoaded, showTraffic, trafficMode]);

  // Animate vehicle particles along the roads
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficMode !== 'particles' || !showTraffic) return;

    let animFrame;

    const animate = () => {
      if (!mapRef.current) return;
      if (!vehiclesRef.current || vehiclesRef.current.length === 0) {
        animFrame = requestAnimationFrame(animate);
        return;
      }

      // 1. Move vehicles along their paths and interpolate coordinates
      const features = vehiclesRef.current.map((v, idx) => {
        v.progress = (v.progress + v.speedFactor) % 1.0;
        const currentCoords = interpolateRoute(v.coords, v.progress);

        return {
          type: 'Feature',
          id: idx,
          geometry: {
            type: 'Point',
            coordinates: currentCoords
          },
          properties: {
            color: v.color,
            routeIdx: v.routeIdx
          }
        };
      });

      // 2. Set the data on the map source
      const source = mapRef.current.getSource('traffic-vehicles');
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features
        });
      }

      animFrame = requestAnimationFrame(animate);
    };

    animFrame = requestAnimationFrame(animate);

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [isLoaded, trafficMode, showTraffic]);

  // Update 3D Hotspot Pillars
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const features = [];
    const fallbackCenters = {
      'Koramangala': [77.6245, 12.9352],
      'HSR Layout': [77.6473, 12.9116],
      'Indiranagar': [77.6408, 12.9784],
      'MG Road': [77.6063, 12.9750],
      'Silk Board': [77.6225, 12.9177],
      'Whitefield': [77.7500, 12.9698],
      'Majestic': [77.5712, 12.9766],
      'Hebbal': [77.5978, 13.0358],
      'Electronic City': [77.6602, 12.8452],
      'Jayanagar': [77.5824, 12.9284],
      'Yelahanka': [77.5862, 13.0978],
      'Marathahalli': [77.6974, 12.9592],
      'Malleshwaram': [77.5720, 12.9984],
      'Banashankari': [77.5736, 12.9156],
      'BTM Layout': [77.6083, 12.9166],
      'Rajajinagar': [77.5562, 12.9892]
    };

    Object.entries(zoneIntensity).forEach(([zone, meta]) => {
      // Snap to static zone centers from fallbackCenters directly
      let lng = BENGALURU_CENTER[0];
      let lat = BENGALURU_CENTER[1];

      if (fallbackCenters[zone]) {
        lng = fallbackCenters[zone][0];
        lat = fallbackCenters[zone][1];
      }

      const score = meta.congestion_score || 0;
      let color = '#34C759'; // Vibrant Neon Green
      if (score >= 75) color = '#FF3B30'; // Vibrant Neon Red
      else if (score >= 50) color = '#FF9500'; // Vibrant Neon Orange
      else if (score >= 25) color = '#FFCC00'; // Vibrant Neon Gold

      const height = Math.max(100, score * 15);

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: getPillarPolygon(lng, lat, 0.0018)
        },
        properties: {
          zone: zone,
          height: height,
          color: color,
          congestion_score: score
        }
      });
    });

    mapRef.current.getSource('hotspot-pillars').setData({
      type: 'FeatureCollection',
      features: features
    });
  }, [zoneIntensity, isLoaded]);

  // Update Individual Incident Points with Multi-Color Coding by Violation Type
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const colorMap = {
      'NO PARKING': '#FFCC00',         // Vibrant Neon Gold
      'DOUBLE PARKING': '#FF9500',     // Vibrant Neon Orange
      'WRONG SIDE PARKING': '#FF2D55', // Vibrant Neon Pink
      'OBSTRUCTING TRAFFIC': '#FF3B30',// Vibrant Neon Red
      'PARKING ON FOOTPATH': '#007AFF',// Vibrant Neon Blue
    };

    const enrichedFeatures = violationsData.map(feature => {
      let primaryViolation = 'NO PARKING';
      let violations = feature.properties?.violation_types || feature.properties?.violation_type || 'NO PARKING';

      if (Array.isArray(violations) && violations.length > 0) {
        primaryViolation = violations[0];
      } else if (typeof violations === 'string') {
        if (violations.startsWith('[') || violations.startsWith('{')) {
          try {
            const parsed = JSON.parse(violations);
            if (Array.isArray(parsed) && parsed.length > 0) {
              primaryViolation = parsed[0];
            }
          } catch {
            primaryViolation = violations;
          }
        } else {
          primaryViolation = violations;
        }
      }

      primaryViolation = String(primaryViolation).toUpperCase().trim();
      const color = colorMap[primaryViolation] || '#EF4444'; // fallback red

      return {
        ...feature,
        properties: {
          ...feature.properties,
          primary_violation: primaryViolation,
          incident_color: color
        }
      };
    });

    mapRef.current.getSource('incident-points').setData({
      type: 'FeatureCollection',
      features: enrichedFeatures
    });
  }, [violationsData, isLoaded]);

  // Flyover Animation Loop
  useEffect(() => {
    if (!mapRef.current) return;

    if (flyoverActive) {
      let lastTime = performance.now();
      const rotateCamera = (time) => {
        if (!mapRef.current) return;
        const delta = time - lastTime;
        lastTime = time;

        const currentBearing = mapRef.current.getBearing();
        const newBearing = (currentBearing + (2 * delta) / 1000) % 360;
        mapRef.current.setBearing(newBearing);

        flyoverAnimRef.current = requestAnimationFrame(rotateCamera);
      };
      flyoverAnimRef.current = requestAnimationFrame(rotateCamera);
    } else {
      if (flyoverAnimRef.current) {
        cancelAnimationFrame(flyoverAnimRef.current);
        flyoverAnimRef.current = null;
      }
    }

    return () => {
      if (flyoverAnimRef.current) {
        cancelAnimationFrame(flyoverAnimRef.current);
      }
    };
  }, [flyoverActive]);

  // Smooth Fly to Selected Zone
  const handleZoneFly = (coords) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: coords,
        zoom: 14.5,
        pitch: 62,
        bearing: 45,
        duration: 2500
      });
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden rounded-xl border border-command-border">
      <div ref={mapContainerRef} className={className} />
      
      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3.5 rounded-xl bg-command-panel p-3.5 shadow-xl border border-command-border/80 backdrop-blur-md max-w-[190px]">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-command-header mb-1">Twin Controls</h4>
        
        <button
          onClick={() => setFlyoverActive(!flyoverActive)}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer border ${
            flyoverActive 
              ? 'bg-command-danger/25 text-command-danger border-command-danger/45 hover:bg-command-danger/35' 
              : 'bg-command-accent/25 text-command-accent border-command-accent/40 hover:bg-command-accent/35'
          }`}
        >
          <svg className={`h-3.5 w-3.5 ${flyoverActive ? 'animate-spin text-command-danger' : 'text-command-accent'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
          </svg>
          <span>{flyoverActive ? 'Stop Rotation' : 'Auto-Rotate'}</span>
        </button>

        <button
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.flyTo({
                center: BENGALURU_CENTER,
                zoom: 12,
                pitch: 55,
                bearing: -15,
                duration: 2000
              });
            }
          }}
          className="flex items-center justify-center gap-2 rounded-lg bg-command-panel/50 hover:bg-command-panel text-command-muted border border-command-border/45 px-3 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors"
        >
          <svg className="h-3.5 w-3.5 text-command-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Reset Camera</span>
        </button>

        {/* Fly to Zone dropdown */}
        <div className="flex flex-col gap-1.5 border-t border-command-border/40 pt-2.5 mt-0.5">
          <div className="flex items-center gap-1.5">
            <svg className="h-3 w-3 text-command-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <label className="text-[9px] font-bold text-command-muted uppercase tracking-wider">Fly to Zone</label>
          </div>
          <div className="relative">
            <select 
              onChange={(e) => {
                if (e.target.value) {
                  const coords = JSON.parse(e.target.value);
                  handleZoneFly(coords);
                }
              }}
              className="w-full appearance-none bg-command-bg border border-command-border/60 text-white text-[10px] rounded-lg pl-2 pr-6 py-1.5 outline-none cursor-pointer focus:border-command-accent transition-colors font-medium"
              defaultValue=""
            >
              <option value="" disabled>Select zone...</option>
              <option value="[77.6245, 12.9352]">Koramangala</option>
              <option value="[77.6408, 12.9784]">Indiranagar</option>
              <option value="[77.6473, 12.9116]">HSR Layout</option>
              <option value="[77.6063, 12.9750]">MG Road</option>
              <option value="[77.6225, 12.9177]">Silk Board</option>
              <option value="[77.7500, 12.9698]">Whitefield</option>
              <option value="[77.5712, 12.9766]">Majestic</option>
              <option value="[77.5978, 13.0358]">Hebbal</option>
              <option value="[77.6602, 12.8452]">Electronic City</option>
              <option value="[77.5824, 12.9284]">Jayanagar</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-command-muted">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Traffic View Mode */}
        <div className="flex flex-col gap-1.5 border-t border-command-border/40 pt-2.5 mt-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <svg className="h-3 w-3 text-command-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <label className="text-[9px] font-bold text-command-muted uppercase tracking-wider">Traffic Mode</label>
          </div>
          <div className="grid grid-cols-3 bg-command-bg/85 rounded-lg p-0.5 border border-command-border/60">
            <button
              onClick={() => setTrafficMode('particles')}
              className={`text-[8px] font-extrabold py-1 rounded transition-all cursor-pointer ${trafficMode === 'particles' ? 'bg-command-accent text-white shadow-sm' : 'text-command-muted hover:text-white'}`}
            >
              Vehicles
            </button>
            <button
              onClick={() => setTrafficMode('trails')}
              className={`text-[8px] font-extrabold py-1 rounded transition-all cursor-pointer ${trafficMode === 'trails' ? 'bg-command-accent text-white shadow-sm' : 'text-command-muted hover:text-white'}`}
            >
              Trails
            </button>
            <button
              onClick={() => setTrafficMode('static')}
              className={`text-[8px] font-extrabold py-1 rounded transition-all cursor-pointer ${trafficMode === 'static' ? 'bg-command-accent text-white shadow-sm' : 'text-command-muted hover:text-white'}`}
            >
              Static
            </button>
          </div>
        </div>

        {/* Toggle Layers */}
        <div className="flex flex-col gap-2 border-t border-command-border/40 pt-2.5 mt-0.5">
          <div className="flex items-center gap-1.5 mb-1">
            <svg className="h-3 w-3 text-command-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <label className="text-[9px] font-bold text-command-muted uppercase tracking-wider">Map Layers</label>
          </div>
          
          <label className="flex items-center justify-between text-[10px] text-command-text cursor-pointer select-none font-medium hover:text-white transition-colors py-0.5">
            <span>3D Pillars</span>
            <div className="relative">
              <input 
                type="checkbox" 
                checked={showPillars} 
                onChange={(e) => setShowPillars(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-7 h-4 rounded-full transition-colors ${showPillars ? 'bg-command-accent' : 'bg-command-bg/80 border border-command-border/60'}`}></div>
              <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${showPillars ? 'translate-x-3' : 'translate-x-0'}`}></div>
            </div>
          </label>
          <label className="flex items-center justify-between text-[10px] text-command-text cursor-pointer select-none font-medium hover:text-white transition-colors py-0.5">
            <span>Traffic Roads</span>
            <div className="relative">
              <input 
                type="checkbox" 
                checked={showTraffic} 
                onChange={(e) => setShowTraffic(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-7 h-4 rounded-full transition-colors ${showTraffic ? 'bg-command-accent' : 'bg-command-bg/80 border border-command-border/60'}`}></div>
              <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${showTraffic ? 'translate-x-3' : 'translate-x-0'}`}></div>
            </div>
          </label>
          <label className="flex items-center justify-between text-[10px] text-command-text cursor-pointer select-none font-medium hover:text-white transition-colors py-0.5">
            <span>Incidents</span>
            <div className="relative">
              <input 
                type="checkbox" 
                checked={showIncidents} 
                onChange={(e) => setShowIncidents(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-7 h-4 rounded-full transition-colors ${showIncidents ? 'bg-command-accent' : 'bg-command-bg/80 border border-command-border/60'}`}></div>
              <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${showIncidents ? 'translate-x-3' : 'translate-x-0'}`}></div>
            </div>
          </label>
          <label className="flex items-center justify-between text-[10px] text-command-text cursor-pointer select-none font-medium hover:text-white transition-colors py-0.5">
            <span>3D Buildings</span>
            <div className="relative">
              <input 
                type="checkbox" 
                checked={showBuildings} 
                onChange={(e) => setShowBuildings(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-7 h-4 rounded-full transition-colors ${showBuildings ? 'bg-command-accent' : 'bg-command-bg/80 border border-command-border/60'}`}></div>
              <div className={`absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform ${showBuildings ? 'translate-x-3' : 'translate-x-0'}`}></div>
            </div>
          </label>
        </div>
      </div>
 
      {/* Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-3 rounded-xl bg-command-panel p-3.5 shadow-xl border border-command-border/80 backdrop-blur-md text-[10px] text-command-text w-[200px]">
        <div className="flex bg-command-bg/85 p-0.5 rounded-lg border border-command-border/60 gap-1 justify-between">
          <button 
            onClick={() => setLegendTab('congestion')}
            className={`flex-1 text-center font-extrabold text-[9px] py-1 rounded transition-all cursor-pointer outline-none ${legendTab === 'congestion' ? 'bg-command-accent text-white shadow-sm' : 'text-command-muted hover:text-white'}`}
          >
            Congestion
          </button>
          <button 
            onClick={() => setLegendTab('violations')}
            className={`flex-1 text-center font-extrabold text-[9px] py-1 rounded transition-all cursor-pointer outline-none ${legendTab === 'violations' ? 'bg-command-accent text-white shadow-sm' : 'text-command-muted hover:text-white'}`}
          >
            Violations
          </button>
        </div>

        {legendTab === 'congestion' ? (
          <div className="space-y-2.5 pt-0.5">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B30] opacity-35"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]"></span>
              </div>
              <span className="font-medium text-white/90">Critical / Avoid (&gt;= 75%)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF9500] shadow-[0_0_6px_#FF9500]"></span>
              </div>
              <span className="font-medium text-white/80">Heavy Delay (&gt;= 50%)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFCC00] shadow-[0_0_6px_#FFCC00]"></span>
              </div>
              <span className="font-medium text-white/80">Moderate Delay (&gt;= 25%)</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34C759] shadow-[0_0_6px_#34C759]"></span>
              </div>
              <span className="font-medium text-white/80">Clear / Low Flow (&lt; 25%)</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pt-0.5">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FFCC00] shadow-[0_0_6px_#FFCC00]"></span>
              </div>
              <span className="font-medium text-white/80">No Parking</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF9500] shadow-[0_0_6px_#FF9500]"></span>
              </div>
              <span className="font-medium text-white/80">Double Parking</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF2D55] shadow-[0_0_6px_#FF2D55]"></span>
              </div>
              <span className="font-medium text-white/80">Wrong Side Parking</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B30] opacity-35"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FF3B30] shadow-[0_0_8px_#FF3B30]"></span>
              </div>
              <span className="font-medium text-white/90">Obstructing Traffic</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#007AFF] shadow-[0_0_6px_#007AFF]"></span>
              </div>
              <span className="font-medium text-white/80">Footpath Parking</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
