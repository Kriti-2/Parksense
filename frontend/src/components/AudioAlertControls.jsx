import { useState, useRef, useEffect } from 'react';

const LABELS = {
  critical: { label: 'Critical Alerts',  desc: 'Congestion ≥ 80 or CRITICAL violations', color: 'text-command-danger',  ring: 'bg-command-danger'  },
  warning:  { label: 'Warning Alerts',   desc: 'Hotspot spikes or MEDIUM violations',    color: 'text-command-warning', ring: 'bg-command-warning' },
  info:     { label: 'Info Alerts',      desc: 'Live feed ticks & status updates',       color: 'text-command-accent',  ring: 'bg-command-accent'  },
};

function VolumeIcon({ muted }) {
  if (muted) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4.243-4.243M12 18l4.243-4.243M6 18l-.01-.01M6 6l-.01.01" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

function BellIcon({ active }) {
  return (
    <svg className="h-4 w-4" fill={active ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default function AudioAlertControls({ audioHook, lastAlertRef }) {
  const { muted, volume, alerts, toggleMute, updateVolume, toggleAlert, test } = audioHook;
  const [open, setOpen] = useState(false);
  const [lastFired, setLastFired] = useState(null);
  const panelRef = useRef(null);

  // Flash indicator when an alert fires
  useEffect(() => {
    if (!lastAlertRef?.current) return;
    const type = lastAlertRef.current;
    setLastFired(type);
    const t = setTimeout(() => setLastFired(null), 1500);
    return () => clearTimeout(t);
  });

  // Close panel on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        id="audio-alert-toggle"
        onClick={() => setOpen((o) => !o)}
        title="Audio Alert Controls"
        className={`relative flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-200 cursor-pointer ${
          muted
            ? 'border-command-border bg-command-panel text-command-muted hover:border-command-accent/30'
            : 'border-command-accent/30 bg-command-accent/10 text-command-accent hover:bg-command-accent/20'
        }`}
      >
        <VolumeIcon muted={muted} />
        <span className="hidden sm:inline">{muted ? 'Alerts Off' : 'Alerts On'}</span>

        {/* Animated ring when alert fires */}
        {lastFired && !muted && (
          <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${LABELS[lastFired]?.ring} animate-ping`} />
        )}
        {!muted && (
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-command-success" />
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-command-border bg-command-panel shadow-2xl shadow-black/20"
          style={{ animation: 'slideDown 0.15s ease-out' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-command-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BellIcon active={!muted} />
              <span className="text-sm font-bold text-white">Audio Alerts</span>
            </div>
            <button
              onClick={toggleMute}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                muted
                  ? 'bg-command-danger/15 text-command-danger hover:bg-command-danger/25'
                  : 'bg-command-success/15 text-command-success hover:bg-command-success/25'
              }`}
            >
              {muted ? '🔇 Muted' : '🔊 Live'}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="px-4 py-3 border-b border-command-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-command-muted">Volume</span>
              <span className="text-[10px] font-mono text-command-accent">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => updateVolume(parseFloat(e.target.value))}
              disabled={muted}
              className="w-full accent-command-accent disabled:opacity-40 cursor-pointer"
              style={{ height: '4px' }}
            />
          </div>

          {/* Per-Alert Toggles */}
          <div className="px-4 py-3 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-command-muted block mb-3">Alert Types</span>
            {Object.entries(LABELS).map(([type, cfg]) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-xl border border-command-border bg-command-bg/40 px-3 py-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.ring} ${alerts[type] && !muted ? 'opacity-100' : 'opacity-30'}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${alerts[type] && !muted ? cfg.color : 'text-command-muted'}`}>
                      {cfg.label}
                    </p>
                    <p className="text-[10px] text-command-muted truncate">{cfg.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {/* Test button */}
                  <button
                    onClick={() => test(type)}
                    title={`Test ${type} tone`}
                    className="flex h-6 w-6 items-center justify-center rounded-lg border border-command-border text-command-muted hover:bg-command-accent/10 hover:text-command-accent hover:border-command-accent/30 transition-all cursor-pointer"
                  >
                    <PlayIcon />
                  </button>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleAlert(type)}
                    disabled={muted}
                    className={`relative h-5 w-9 rounded-full border transition-all duration-200 disabled:opacity-40 cursor-pointer ${
                      alerts[type]
                        ? 'border-command-accent bg-command-accent'
                        : 'border-command-border bg-command-bg'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-all duration-200 ${
                        alerts[type] ? 'left-[calc(100%-1rem)]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="border-t border-command-border px-4 py-2.5">
            <p className="text-[9px] text-command-muted text-center">
              Sounds synthesised in-browser · No external files required
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
