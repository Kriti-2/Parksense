import { useState, useEffect } from 'react';

const CYCLING_TEXTS = [
  'Connecting to Bengaluru Traffic Control...',
  'Analyzing live traffic feeds...',
  'Evaluating economic impact...',
  'Predicting congestion hotspots...',
  'Optimizing emergency corridors...',
  'Loading dashboard widgets...',
];

export default function PageLoader({ error, onRetry, loadingText }) {
  const [textIndex, setTextIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (error) return;

    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTextIndex((prev) => (prev + 1) % CYCLING_TEXTS.length);
        setFade(true);
      }, 300); // match transition duration
    }, 2800);

    return () => clearInterval(interval);
  }, [error]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 animate-fadeIn">
        <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-red-950/10 px-8 py-10 text-center shadow-[0_20px_50px_-10px_rgba(239,68,68,0.15)] backdrop-blur-md">
          {/* Glowing Warning Backdrop */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-red-500/[0.03] to-transparent pointer-events-none rounded-2xl" />
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Logo with Red Alert Ring */}
            <div className="relative mb-6">
              <div className="absolute -inset-1.5 rounded-2xl bg-red-500/20 blur animate-pulse" />
              <img src="/logo.png" alt="Logo" className="relative h-14 w-14 object-contain bg-white p-1 rounded-2xl border border-red-500/30" />
            </div>

            <h3 className="text-lg font-black text-red-400 uppercase tracking-widest mb-2">Connection Error</h3>
            
            <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6 max-w-xs">
              {error || 'Failed to connect to the backend server. Ensure the server is running on port 8000.'}
            </p>

            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-6 py-3 tracking-widest uppercase transition-all duration-200 active:scale-[0.97] cursor-pointer shadow-[0_8px_20px_rgba(239,68,68,0.3)]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.5" />
                </svg>
                Retry Connection
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 animate-fadeIn">
      <div className="text-center flex flex-col items-center max-w-xs">
        {/* Pulsing Logo & Outer Ring */}
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
          {/* Animated Circular Border */}
          <div className="absolute inset-0 rounded-full border-[3px] border-t-[#5E8599] border-r-transparent border-b-[#5E8599] border-l-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
          
          {/* Inner Pulsing Shadow */}
          <div className="absolute h-14 w-14 rounded-full bg-[#5E8599]/15 blur-md animate-pulse" />
          
          {/* Centered Sharp Logo */}
          <img
            src="/logo.png"
            alt="Logo"
            className="relative h-12 w-12 object-contain bg-white p-1 rounded-xl shadow-sm border border-gray-100"
          />
        </div>

        {/* Brand Name */}
        <h4 className="text-sm font-extrabold text-[#5E8599] tracking-widest uppercase mb-1">मार्ग Sense</h4>

        {/* Cycling Status Text with Fade Animation */}
        <p
          className={`text-xs text-gray-400 font-semibold h-8 transition-opacity duration-300 leading-normal ${
            fade ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {loadingText || CYCLING_TEXTS[textIndex]}
        </p>
      </div>
    </div>
  );
}
