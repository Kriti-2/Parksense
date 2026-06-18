import { useCallback, useEffect, useState } from 'react';

const playedIds = new Set();

export function playSpatialViolationSound(latitude, longitude, id) {
  if (typeof window === 'undefined') return;
  
  // Check if audio alerts are enabled in localStorage
  if (localStorage.getItem('parksense_audio_alerts_enabled') === 'false') {
    return;
  }

  if (id && playedIds.has(id)) {
    return;
  }
  if (id) {
    playedIds.add(id);
    if (playedIds.size > 200) {
      const firstKey = playedIds.keys().next().value;
      playedIds.delete(firstKey);
    }
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Bengaluru center longitude is 77.5946
    // Map longitude diff relative to center. Far east (Whitefield) is 77.75 (+0.155), Far west is ~77.49 (-0.1)
    const bngLng = 77.5946;
    const diff = longitude - bngLng;
    // Scale diff * 10 so +/- 0.1 degree translates to +/- 1.0 panning
    const pan = Math.min(1, Math.max(-1, diff * 10));
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Sonar/radar ping sound: high sweep down
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.4);
    
    // Very quiet volume for pleasant ambient monitoring
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    let target = gain;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, ctx.currentTime);
      gain.connect(panner);
      target = panner;
    }
    
    target.connect(ctx.destination);
    osc.connect(gain);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (error) {
    console.warn("Failed to play spatial audio alert:", error);
  }
}

export function useLiveFeed(onTick) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);

  const stableOnTick = useCallback(
    (payload) => {
      if (onTick) onTick(payload);
    },
    [onTick]
  );

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/live/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.live_mode !== undefined && !payload.type) {
          setStatus(payload);
        } else {
          setStatus((prev) => ({ ...prev, last_tick: payload.timestamp, traffic: payload.data_sources?.traffic }));
          
          // Play spatial audio ping for new violations
          if (payload.new_violations && Array.isArray(payload.new_violations)) {
            payload.new_violations.forEach((v, index) => {
              setTimeout(() => {
                playSpatialViolationSound(v.latitude, v.longitude, v.id);
              }, index * 220);
            });
          }
          
          stableOnTick(payload);
        }
      } catch {
        /* ignore malformed messages */
      }
    };

    return () => ws.close();
  }, [stableOnTick]);

  return { connected, status };
}
