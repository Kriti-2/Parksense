import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGoogleOAuthUrl } from '../api/client';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  
  // Theme state: check local storage or system preference
  const [isDark, setIsDark] = useState(() => {
    const storedTheme = localStorage.getItem('parksense_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return storedTheme === 'dark' || (!storedTheme && systemPrefersDark);
  });

  const [mode, setMode] = useState('user'); // Toggle: 'user' (Citizen) vs 'officer' (Officer Command)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sync tailwind html tag with theme state
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('parksense_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('parksense_theme', 'light');
    }
  }, [isDark]);

  // Login submission
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      navigate(u.role === 'officer' ? '/' : '/congestion');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  // Populate Demo Credentials (Citizen vs Officer)
  function fillDemo() {
    if (mode === 'officer') {
      setEmail('officer@parksense.demo');
      setPassword('officer123');
    } else {
      setEmail('user@parksense.demo');
      setPassword('user123');
    }
  }

  if (user) {
    return <Navigate to={user.role === 'officer' ? '/' : '/congestion'} replace />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden transition-colors duration-300 bg-slate-950">
      
      {/* 4K 60fps Loop Video Background (Autoplay, Loop, Muted, GPU-accelerated) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 h-full w-full object-cover transform-gpu will-change-[filter] transition-all duration-500 brightness-[0.35] contrast-[1.05] dark:brightness-[0.2] dark:contrast-[1.1]"
      >
        <source src="/traffic_video/12926930_3840_2160_60fps.mp4" type="video/mp4" />
        <source src="https://assets.mixkit.co/videos/preview/mixkit-city-traffic-at-night-vertical-shot-34469-large.mp4" type="video/mp4" />
      </video>

      {/* Grid overlay overlay for high-tech aesthetic */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(18,24,38,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.25)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />

      {/* Floating Theme Toggle Switch at Top Right */}
      <div className="absolute top-5 right-5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700/40 dark:border-teal-500/20 bg-white/10 dark:bg-[#060913]/70 text-slate-200 dark:text-teal-400 shadow-[0_4px_25px_rgba(0,0,0,0.3)] backdrop-blur-md transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle Theme"
        >
          {isDark ? (
            // Sun icon
            <svg className="h-5.5 w-5.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.02 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41s-1.02-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.01c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
            </svg>
          ) : (
            // Moon icon
            <svg className="h-5.5 w-5.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      {/* Centered High-Fidelity Login Card (GPU accelerated to avoid lag over 4K video) */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-4 py-8 pointer-events-none">
        <div className="w-full max-w-[370px] rounded-3xl border border-white/10 dark:border-teal-500/20 bg-white/[0.01] dark:bg-black/[0.05] px-9 py-10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-lg transition-all duration-300 transform-gpu will-change-transform pointer-events-auto">
          
          {/* Logo, Header, and Pulsing Live Badge */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-2 mb-1.5">
              {/* Green Rounded Map-Pin Icon */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D9E75] shadow-lg shadow-[#1D9E75]/30">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white select-none">ParkSense AI</h1>
            </div>
            
            {/* Live Badge */}
            <div className="flex items-center gap-1.5 rounded-full bg-teal-950/45 px-3 py-0.5 border border-teal-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 select-none">Bengaluru · Live</span>
            </div>
          </div>

          {/* Mode Selector Segmented Toggle */}
          <div className="mb-5 flex rounded-2xl bg-white/[0.03] dark:bg-black/[0.1] p-1 border border-white/5">
            <button
              type="button"
              onClick={() => setMode('user')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                mode === 'user' 
                  ? 'border border-[rgba(29,158,117,0.4)] text-[#1D9E75] bg-[rgba(29,158,117,0.15)] shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Citizen
            </button>
            <button
              type="button"
              onClick={() => setMode('officer')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                mode === 'officer' 
                  ? 'border border-[rgba(29,158,117,0.4)] text-[#1D9E75] bg-[rgba(29,158,117,0.15)] shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Officer
            </button>
          </div>

          {/* Subtext description */}
          <p className="mb-4 text-center text-xs text-gray-300 dark:text-gray-400 font-semibold select-none leading-relaxed">
            {mode === 'user' 
              ? 'Plan your commute — see congestion and parking hotspots before you travel.'
              : 'Command center access for Bengaluru traffic enforcement.'}
          </p>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4.5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 select-none">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-white/10 dark:border-slate-800/80 bg-white/[0.02] dark:bg-black/[0.15] px-4 py-3 text-sm text-white outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 transition-all duration-300 placeholder-gray-600"
                placeholder={mode === 'officer' ? 'officer@parksense.demo' : 'you@email.com'}
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 select-none">Password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 dark:border-slate-800/80 bg-white/[0.02] dark:bg-black/[0.15] px-4 py-3 pr-11 text-sm text-white outline-none focus:border-[#1D9E75] focus:ring-2 focus:ring-[#1D9E75]/20 transition-all duration-300"
                />
                {/* Visibility eye toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 cursor-pointer"
                >
                  {showPassword ? (
                    <svg className="h-4.5 w-4.5 text-gray-500 hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4.5 w-4.5 text-gray-500 hover:text-teal-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-[11px] font-bold text-command-danger">{error}</p>}
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#1D9E75] py-3 font-bold uppercase text-[11px] tracking-widest text-white hover:opacity-95 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-lg shadow-[#1D9E75]/25 mt-4"
            >
              {loading 
                ? 'Signing in...' 
                : mode === 'officer' 
                  ? 'Sign In as Officer' 
                  : 'Sign In as Citizen'}
            </button>
          </form>

          {/* Google Citizen Login */}
          {mode === 'user' && (
            <a
              href={getGoogleOAuthUrl()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 dark:border-slate-800/80 py-3 text-xs font-bold text-white bg-white/[0.03] hover:bg-white/10 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>Sign in with Google</span>
              <span className="text-[10px] text-gray-500 font-normal">(Citizen OAuth)</span>
            </a>
          )}

          {/* Demo Credentials Filler */}
          <button
            type="button"
            onClick={fillDemo}
            className="mt-4 w-full text-center text-xs text-[#1D9E75] hover:underline cursor-pointer bg-transparent border-none outline-none select-none font-bold"
          >
            Use demo {mode} credentials
          </button>

          {/* Citizen register link */}
          {mode === 'user' && (
            <p className="mt-4 text-center text-xs text-gray-400 select-none">
              New here?{' '}
              <Link to="/register" className="text-[#1D9E75] hover:underline font-bold">
                Create account
              </Link>
            </p>
          )}

          {/* Sensor-Dashboard Styled Stat Pills */}
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 dark:border-slate-800/40 pt-5 select-none">
            <div className="rounded-xl bg-white/[0.01] dark:bg-black/[0.08] border border-white/5 p-2 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-0.75 bg-red-500"></div>
              <div className="text-[9px] text-gray-400 font-bold">Violations</div>
              <div className="text-xs text-red-400 font-black tracking-wide mt-0.5">791+</div>
            </div>
            
            <div className="rounded-xl bg-white/[0.01] dark:bg-black/[0.08] border border-white/5 p-2 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-0.75 bg-green-500"></div>
              <div className="text-[9px] text-gray-400 font-bold">Active Zones</div>
              <div className="text-xs text-green-400 font-black tracking-wide mt-0.5">6</div>
            </div>
            
            <div className="rounded-xl bg-white/[0.01] dark:bg-black/[0.08] border border-white/5 p-2 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-0.75 bg-teal-500"></div>
              <div className="text-[9px] text-gray-400 font-bold">Forecast</div>
              <div className="text-xs text-teal-400 font-black tracking-wide mt-0.5">24h</div>
            </div>
          </div>

          {/* Footer block */}
          <div className="mt-6 flex items-center justify-between text-[10px] text-gray-500 font-medium border-t border-white/10 dark:border-slate-800/20 pt-4 select-none">
            <span>BBMP authorized only</span>
            <button type="button" className="hover:text-teal-400 hover:underline cursor-pointer bg-transparent border-none">
              Forgot password?
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
