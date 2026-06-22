import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const BENGALURU_CENTER = [77.5946, 12.9716]; // [lng, lat] for MapLibre

// Helper to generate a 6-sided hexagon polygon around a point for 3D extrusion
function getHexagonPolygon(lng, lat, radius = 0.0016) {
  const coordinates = [];
  const sides = 6;
  for (let i = 0; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    const dx = radius * Math.cos(angle);
    // Adjust latitude offset slightly to maintain a regular hexagon on spherical projection
    const dy = radius * Math.sin(angle) * 1.15;
    coordinates.push([lng + dx, lat + dy]);
  }
  return [coordinates];
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
  const [flyoverActive, setFlyoverActive] = useState(true);
  const flyoverAnimRef = useRef(null);

  // Layer toggles
  const [showPillars, setShowPillars] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showBuildings, setShowBuildings] = useState(true);
  const [cyberTheme, setCyberTheme] = useState('night'); // 'night', 'sunset', or 'matrix'
  const [settingsExpanded, setSettingsExpanded] = useState(false);

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
      zoom: 13.9,
      pitch: 62,
      bearing: -25,
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
      // 0. Ground Radars under Hotspots
      map.addSource('hotspot-radar', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.addLayer({
        id: 'hotspot-radar-layer',
        source: 'hotspot-radar',
        type: 'circle',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': ['get', 'opacity'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': ['get', 'stroke_opacity'],
          'circle-pitch-alignment': 'map',
          'circle-pitch-scale': 'map'
        }
      });

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

      // Neon bottom glow layer
      map.addLayer({
        id: 'traffic-flows-glow',
        source: 'traffic-flows',
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 10,
          'line-opacity': 0.35,
          'line-blur': 5.0
        }
      });

      // Neon sharp central core layer
      map.addLayer({
        id: 'traffic-flows-core',
        source: 'traffic-flows',
        type: 'line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3.0,
          'line-opacity': 0.95
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
          'circle-radius': 5.0,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#FFFFFF',
          'circle-opacity': 0.95,
          'circle-blur': 0.15
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

        const colorClass = score >= 75 ? 'text-red-400' : score >= 50 ? 'text-orange-400' : 'text-emerald-400';

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
    const visibility = showPillars ? 'visible' : 'none';
    if (mapRef.current.getLayer('hotspot-pillars-layer')) {
      mapRef.current.setLayoutProperty('hotspot-pillars-layer', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('hotspot-radar-layer')) {
      mapRef.current.setLayoutProperty('hotspot-radar-layer', 'visibility', visibility);
    }
  }, [showPillars, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    const visibility = showTraffic ? 'visible' : 'none';
    if (mapRef.current.getLayer('traffic-flows-glow')) {
      mapRef.current.setLayoutProperty('traffic-flows-glow', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('traffic-flows-core')) {
      mapRef.current.setLayoutProperty('traffic-flows-core', 'visibility', visibility);
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
    if (mapRef.current.getLayer('traffic-flows-core')) {
      if (trafficMode === 'static') {
        mapRef.current.setPaintProperty('traffic-flows-core', 'line-dasharray', [4, 4]);
        mapRef.current.setPaintProperty('traffic-flows-glow', 'line-dasharray', [4, 4]);
      } else if (trafficMode === 'particles') {
        mapRef.current.setPaintProperty('traffic-flows-core', 'line-dasharray', [1, 0]);
        mapRef.current.setPaintProperty('traffic-flows-glow', 'line-dasharray', [1, 0]);
      } else if (trafficMode === 'trails') {
        // Core trails will be animated, reset glow to full line
        mapRef.current.setPaintProperty('traffic-flows-glow', 'line-dasharray', [1, 0]);
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
      const color = route.properties.color || '#10B981';
      
      // Spawn 3 vehicles per route staggered at different starting offsets
      const numVehicles = 3;
      for (let i = 0; i < numVehicles; i++) {
        initialVehicles.push({
          routeIdx,
          coords,
          progress: i / numVehicles,
          speedFactor: (speed / 60) * 0.0008 + 0.0003,
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
        
        if (mapRef.current.getLayer('traffic-flows-core') && showTraffic) {
          mapRef.current.setPaintProperty('traffic-flows-core', 'line-dasharray', [
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

  // Animate vehicle particles along the roads (Throttled to ~30 FPS for performance)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    if (trafficMode !== 'particles' || !showTraffic) return;

    let animFrame;
    let lastTime = performance.now();

    const animate = (time) => {
      if (!mapRef.current) return;
      
      const elapsed = time - lastTime;
      // Target ~30 FPS (33ms) to reduce CPU utilization
      if (elapsed >= 33) {
        lastTime = time;

        if (!vehiclesRef.current || vehiclesRef.current.length === 0) {
          animFrame = requestAnimationFrame(animate);
          return;
        }

        // Normalize animation speed by delta time relative to 60 FPS (16.67ms per frame)
        const deltaMultiplier = elapsed / 16.67;

        // 1. Move vehicles along their paths and interpolate coordinates
        const features = vehiclesRef.current.map((v, idx) => {
          v.progress = (v.progress + v.speedFactor * deltaMultiplier) % 1.0;
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

  // Update Map Theme Aesthetics (Lighting & Building Colors)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    
    const themeConfigs = {
      night: {
        lightColor: '#a855f7',
        lightIntensity: 0.35,
        lightPos: [1.15, 210, 30],
        buildingColors: [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#161622',
          30, '#282a36',
          70, '#3f51b5',
          120, '#00e5ff'
        ]
      },
      sunset: {
        lightColor: '#fdba74',
        lightIntensity: 0.45,
        lightPos: [1.5, 90, 80],
        buildingColors: [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#1a0f0f',
          30, '#3a221d',
          70, '#d97706',
          120, '#f43f5e'
        ]
      },
      matrix: {
        lightColor: '#6ee7b7',
        lightIntensity: 0.40,
        lightPos: [1.3, 140, 45],
        buildingColors: [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#0d1b15',
          30, '#1b2e24',
          70, '#059669',
          120, '#10b981'
        ]
      }
    };
    
    const config = themeConfigs[cyberTheme] || themeConfigs.night;
    
    // Update light properties
    mapRef.current.setLight({
      anchor: 'viewport',
      color: config.lightColor,
      intensity: config.lightIntensity,
      position: config.lightPos
    });
    
    // Update building fill-extrusion-color property
    if (mapRef.current.getLayer('3d-buildings')) {
      mapRef.current.setPaintProperty('3d-buildings', 'fill-extrusion-color', config.buildingColors);
      mapRef.current.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', 0.82);
    }
  }, [cyberTheme, isLoaded]);

  // Update 3D Hotspot Pillars (Static data update - only when zone intensity changes, not every frame)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const pillarSource = mapRef.current.getSource('hotspot-pillars');
    if (!pillarSource) return;

    if (!showPillars) {
      pillarSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

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

    const pillarFeatures = [];

    Object.entries(zoneIntensity).forEach(([zone, meta]) => {
      let lng = BENGALURU_CENTER[0];
      let lat = BENGALURU_CENTER[1];

      if (fallbackCenters[zone]) {
        lng = fallbackCenters[zone][0];
        lat = fallbackCenters[zone][1];
      }

      const score = meta.congestion_score || 0;
      let color = '#10B981'; // Vibrant Neon Emerald Green
      if (score >= 75) color = '#FF3B30'; // Vibrant Neon Red
      else if (score >= 50) color = '#FF9500'; // Vibrant Neon Orange
      else if (score >= 25) color = '#FFCC00'; // Vibrant Neon Gold

      const baseHeight = Math.max(100, score * 15);

      // 3D Hexagon Column
      pillarFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: getHexagonPolygon(lng, lat, 0.0016)
        },
        properties: {
          zone: zone,
          height: baseHeight,
          color: color,
          congestion_score: score
        }
      });
    });

    pillarSource.setData({
      type: 'FeatureCollection',
      features: pillarFeatures
    });
  }, [zoneIntensity, isLoaded, showPillars]);

  // Animate flat ground radar ripples (Throttled to ~30 FPS for performance)
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    let animFrame;
    const radarSource = mapRef.current.getSource('hotspot-radar');
    if (!radarSource) return;

    if (!showPillars) {
      radarSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

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

    const startTime = performance.now();
    let lastTime = startTime;

    const animateRipples = (time) => {
      if (!mapRef.current) return;

      const elapsed = time - lastTime;
      // Throttle update to ~30 FPS (~33ms) to avoid CPU lag
      if (elapsed >= 33) {
        lastTime = time;

        const elapsedSeconds = (time - startTime) / 1000;
        // Calculate double ripple progresses
        const pulse1 = (elapsedSeconds * 0.85) % 1.0;
        const pulse2 = (pulse1 + 0.5) % 1.0;

        const radarFeatures = [];

        Object.entries(zoneIntensity).forEach(([zone, meta]) => {
          let lng = BENGALURU_CENTER[0];
          let lat = BENGALURU_CENTER[1];

          if (fallbackCenters[zone]) {
            lng = fallbackCenters[zone][0];
            lat = fallbackCenters[zone][1];
          }

          const score = meta.congestion_score || 0;
          let color = '#10B981'; // Vibrant Neon Emerald Green
          if (score >= 75) color = '#FF3B30'; // Vibrant Neon Red
          else if (score >= 50) color = '#FF9500'; // Vibrant Neon Orange
          else if (score >= 25) color = '#FFCC00'; // Vibrant Neon Gold

          // Staggered ground ripple 1
          radarFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            properties: {
              color: color,
              radius: 8 + pulse1 * 32, // expands from 8px to 40px
              opacity: (1.0 - pulse1) * 0.22,
              stroke_opacity: (1.0 - pulse1) * 0.70
            }
          });

          // Staggered ground ripple 2
          radarFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            properties: {
              color: color,
              radius: 8 + pulse2 * 32,
              opacity: (1.0 - pulse2) * 0.22,
              stroke_opacity: (1.0 - pulse2) * 0.70
            }
          });
        });

        const source = mapRef.current.getSource('hotspot-radar');
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: radarFeatures
          });
        }
      }

      animFrame = requestAnimationFrame(animateRipples);
    };

    animFrame = requestAnimationFrame(animateRipples);

    return () => {
      if (animFrame) {
        cancelAnimationFrame(animFrame);
      }
    };
  }, [zoneIntensity, isLoaded, showPillars]);

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
        const newBearing = (currentBearing + (0.75 * delta) / 1000) % 360;
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
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5 items-start">
        {/* Main Sleek Floating Bar */}
        <div className="flex items-center gap-1.5 rounded-xl bg-[#090D16]/80 p-1.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg">
          {/* Drone Button */}
          <button
            onClick={() => setFlyoverActive(!flyoverActive)}
            title={flyoverActive ? 'Stop Drone Orbit' : 'Start Drone Orbit'}
            className={`flex h-7.5 items-center justify-center gap-1.5 rounded-lg px-2 text-[9px] font-bold transition-all cursor-pointer border ${
              flyoverActive 
                ? 'bg-slate-800 text-white border-slate-650' 
                : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800/80'
            }`}
          >
            <svg className={`h-4 w-4 ${flyoverActive ? 'text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10a2 2 0 100 4 2 2 0 000-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 10.5L7 7M13.5 10.5L17 7M10.5 13.5L7 17M13.5 13.5L17 17" />
              <circle cx="6" cy="6" r="1.5" className="fill-current/30" />
              <circle cx="18" cy="6" r="1.5" className="fill-current/30" />
              <circle cx="6" cy="18" r="1.5" className="fill-current/30" />
              <circle cx="18" cy="18" r="1.5" className="fill-current/30" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14.5l-1 2h6l-1-2" />
            </svg>
            <span>Drone</span>
          </button>

          {/* Reset Camera Button */}
          <button
            onClick={() => {
              if (mapRef.current) {
                mapRef.current.flyTo({
                  center: BENGALURU_CENTER,
                  zoom: 13.9,
                  pitch: 62,
                  bearing: -25,
                  duration: 2000
                });
              }
            }}
            title="Reset Camera View"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>

          {/* Zoom In Button */}
          <button
            onClick={() => {
              if (mapRef.current) {
                const currentZoom = mapRef.current.getZoom();
                mapRef.current.easeTo({
                  zoom: Math.min(currentZoom + 0.8, 18),
                  duration: 800
                });
              }
            }}
            title="Zoom In"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Zoom Out Button */}
          <button
            onClick={() => {
              if (mapRef.current) {
                const currentZoom = mapRef.current.getZoom();
                mapRef.current.easeTo({
                  zoom: Math.max(currentZoom - 0.8, 10),
                  duration: 800
                });
              }
            }}
            title="Zoom Out"
            className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 transition-colors cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>

          {/* Divider */}
          <div className="h-5 w-[1px] bg-slate-800 mx-0.5" />

          {/* Settings Expand Button */}
          <button
            onClick={() => setSettingsExpanded(!settingsExpanded)}
            title="Toggle Settings"
            className={`flex h-7.5 w-7.5 items-center justify-center rounded-lg transition-colors cursor-pointer border ${
              settingsExpanded 
                ? 'bg-slate-800 text-white border-slate-650' 
                : 'bg-slate-900/50 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800/80'
            }`}
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ${settingsExpanded ? 'rotate-90 text-white' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Collapsible Dropdown Panel */}
        {settingsExpanded && (
          <div className="w-[190px] rounded-xl bg-[#090D16]/85 p-3 shadow-[0_12px_40px_0_rgba(0,0,0,0.6)] border border-slate-800/80 backdrop-blur-lg flex flex-col gap-2.5 animate-fadeIn text-slate-200">
            {/* Fly to Zone dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Fly to Zone
              </label>
              <div className="relative">
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      const coords = JSON.parse(e.target.value);
                      handleZoneFly(coords);
                    }
                  }}
                  className="w-full appearance-none bg-slate-950/70 border border-slate-800/80 text-white text-[9px] rounded-lg pl-2.5 pr-6 py-1 outline-none cursor-pointer focus:border-cyan-500/60 transition-colors font-semibold"
                  defaultValue=""
                >
                  <option value="" disabled className="bg-slate-950 text-slate-400">Select zone...</option>
                  <option value="[77.6245, 12.9352]" className="bg-slate-950 text-white">Koramangala</option>
                  <option value="[77.6408, 12.9784]" className="bg-slate-950 text-white">Indiranagar</option>
                  <option value="[77.6473, 12.9116]" className="bg-slate-950 text-white">HSR Layout</option>
                  <option value="[77.6063, 12.9750]" className="bg-slate-950 text-white">MG Road</option>
                  <option value="[77.6225, 12.9177]" className="bg-slate-950 text-white">Silk Board</option>
                  <option value="[77.7500, 12.9698]" className="bg-slate-950 text-white">Whitefield</option>
                  <option value="[77.5712, 12.9766]" className="bg-slate-950 text-white">Majestic</option>
                  <option value="[77.5978, 13.0358]" className="bg-slate-950 text-white">Hebbal</option>
                  <option value="[77.6602, 12.8452]" className="bg-slate-950 text-white">Electronic City</option>
                  <option value="[77.5824, 12.9284]" className="bg-slate-950 text-white">Jayanagar</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Cyber Theme Selector */}
            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Cyber Theme
              </label>
              <div className="grid grid-cols-3 bg-slate-950/65 rounded-lg p-0.5 border border-slate-800/80">
                <button
                  onClick={() => setCyberTheme('night')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${cyberTheme === 'night' ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)] font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Night
                </button>
                <button
                  onClick={() => setCyberTheme('sunset')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${cyberTheme === 'sunset' ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.4)] font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Sunset
                </button>
                <button
                  onClick={() => setCyberTheme('matrix')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${cyberTheme === 'matrix' ? 'bg-emerald-600 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)] font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Matrix
                </button>
              </div>
            </div>

            {/* Traffic View Mode */}
            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Traffic Mode
              </label>
              <div className="grid grid-cols-3 bg-slate-950/65 rounded-lg p-0.5 border border-slate-800/80">
                <button
                  onClick={() => setTrafficMode('particles')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${trafficMode === 'particles' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Vehicles
                </button>
                <button
                  onClick={() => setTrafficMode('trails')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${trafficMode === 'trails' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Trails
                </button>
                <button
                  onClick={() => setTrafficMode('static')}
                  className={`text-[8px] font-extrabold py-0.5 rounded transition-all cursor-pointer ${trafficMode === 'static' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  Static
                </button>
              </div>
            </div>

            {/* Toggle Layers */}
            <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Map Layers
              </label>
              
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-0.5">
                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>3D Pillars</span>
                  <input 
                    type="checkbox" 
                    checked={showPillars} 
                    onChange={(e) => setShowPillars(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>
                
                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>Traffic</span>
                  <input 
                    type="checkbox" 
                    checked={showTraffic} 
                    onChange={(e) => setShowTraffic(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>Incidents</span>
                  <input 
                    type="checkbox" 
                    checked={showIncidents} 
                    onChange={(e) => setShowIncidents(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-[8px] text-slate-300 cursor-pointer select-none font-semibold hover:text-white transition-colors">
                  <span>Buildings</span>
                  <input 
                    type="checkbox" 
                    checked={showBuildings} 
                    onChange={(e) => setShowBuildings(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500/40 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
 
      {/* Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-3 rounded-xl bg-[#090D16]/80 p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] border border-slate-800/80 backdrop-blur-lg text-[10px] text-slate-300 w-[200px]">
        <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-slate-800/80 gap-1 justify-between">
          <button 
            onClick={() => setLegendTab('congestion')}
            className={`flex-1 text-center font-extrabold text-[9px] py-1 rounded transition-all cursor-pointer outline-none ${legendTab === 'congestion' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
          >
            Congestion
          </button>
          <button 
            onClick={() => setLegendTab('violations')}
            className={`flex-1 text-center font-extrabold text-[9px] py-1 rounded transition-all cursor-pointer outline-none ${legendTab === 'violations' ? 'bg-slate-800 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
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
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981] shadow-[0_0_6px_#10B981]"></span>
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
