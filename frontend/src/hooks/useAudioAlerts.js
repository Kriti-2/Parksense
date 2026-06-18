import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'parksense_audio_prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Play a soft chime tone using the Web Audio API.
 * All oscillators use sine waves with smooth exponential-decay envelopes
 * for a pleasant, notification-style sound.
 * @param {AudioContext} ctx
 * @param {'critical'|'warning'|'info'} type
 * @param {number} volume 0–1
 */
function synthesise(ctx, type, volume) {
  const now = ctx.currentTime;

  /**
   * Helper: play one sine-wave note with an attack + exponential decay.
   * @param {number} freq   - frequency in Hz
   * @param {number} start  - start time offset from now
   * @param {number} dur    - duration in seconds
   * @param {number} amp    - amplitude (0–1)
   */
  function chime(freq, start, dur, amp) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + start);

    // Soft attack then smooth exponential decay
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(volume * amp, now + start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.05);
  }

  if (type === 'critical') {
    // Three descending chimes: C5 → A4 → F4  (urgent but musical)
    chime(523.25, 0.00, 0.55, 0.75);  // C5
    chime(440.00, 0.18, 0.50, 0.65);  // A4
    chime(349.23, 0.36, 0.65, 0.55);  // F4
  } else if (type === 'warning') {
    // Two-note warm chime: E5 → C5
    chime(659.25, 0.00, 0.45, 0.60);  // E5
    chime(523.25, 0.22, 0.55, 0.50);  // C5
  } else {
    // Single gentle rising blip: C5 → E5
    chime(523.25, 0.00, 0.25, 0.45);  // C5
    chime(659.25, 0.12, 0.30, 0.35);  // E5
  }
}

export function useAudioAlerts() {
  const ctxRef = useRef(null);

  const savedPrefs = loadPrefs();
  const [muted, setMuted]   = useState(savedPrefs.muted   ?? false);
  const [volume, setVolume] = useState(savedPrefs.volume  ?? 0.7);
  const [alerts, setAlerts] = useState({
    critical: savedPrefs.alerts?.critical ?? true,
    warning:  savedPrefs.alerts?.warning  ?? true,
    info:     savedPrefs.alerts?.info     ?? true,
  });

  // ------- refs that shadow state so play/test stay stable -------
  const mutedRef  = useRef(muted);
  const volumeRef = useRef(volume);
  const alertsRef = useRef(alerts);

  useEffect(() => { mutedRef.current  = muted;  }, [muted]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  // Persist whenever settings change
  useEffect(() => {
    savePrefs({ muted, volume, alerts });
  }, [muted, volume, alerts]);

  function ensureCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }

  // Stable reference — reads from refs, never changes identity
  const play = useCallback((type) => {
    if (mutedRef.current || !alertsRef.current[type]) return;
    try {
      const ctx = ensureCtx();
      synthesise(ctx, type, volumeRef.current);
    } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable reference — ignores mute, always plays for preview
  const test = useCallback((type) => {
    try {
      const ctx = ensureCtx();
      synthesise(ctx, type, volumeRef.current);
    } catch (_) {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMute()        { setMuted((m)  => !m); }
  function updateVolume(v)     { setVolume(v); }
  function toggleAlert(type)   { setAlerts((prev) => ({ ...prev, [type]: !prev[type] })); }

  return { muted, volume, alerts, play, test, toggleMute, updateVolume, toggleAlert };
}
