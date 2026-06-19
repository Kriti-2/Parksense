import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGoogleOAuthUrl } from '../api/client';
import ChatBot from '../components/ChatBot';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
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

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (oauthError === 'google_oauth_denied') {
      setError('Google sign-in was cancelled');
    } else if (oauthError === 'google_oauth_failed') {
      setError('Google sign-in failed. Check OAuth redirect URI and client credentials.');
    }
  }, [searchParams]);

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
      navigate('/');
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
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-center py-6 transition-colors duration-300 bg-neutral-950">
      
      {/* Desktop Video Background (4K Loop, Hidden on Mobile) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="hidden sm:block fixed inset-0 z-0 h-full w-full object-cover transform-gpu will-change-[filter] transition-all duration-500 brightness-[0.45] contrast-[1.05] dark:brightness-[0.3] dark:contrast-[1.1]"
      >
        <source src="/traffic_video/12926930_3840_2160_60fps.mp4" type="video/mp4" />
      </video>

      {/* Mobile Video Background (Brighter, Hidden on Desktop) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="block sm:hidden fixed inset-0 z-0 h-full w-full object-cover transform-gpu will-change-[filter] transition-all duration-500 brightness-[0.52] contrast-[1.05] dark:brightness-[0.38] dark:contrast-[1.1]"
      >
        <source src="/traffic_video/12926930_3840_2160_60fps.mp4" type="video/mp4" />
      </video>

      {/* Floating Theme Toggle Switch at Top Right */}
      <div className="fixed top-5 right-5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white shadow-[0_4px_25px_rgba(0,0,0,0.3)] backdrop-blur-md transition-all duration-200 cursor-pointer hover:scale-105 hover:border-white/30 active:scale-95"
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
      <div className="z-10 flex items-center justify-center px-4 w-full pointer-events-none">
        <div className="relative w-full max-w-[360px] rounded-3xl border border-white/20 bg-white/[0.08] px-6 py-6.5 text-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-3xl backdrop-saturate-200 transition-all duration-300 transform-gpu will-change-transform pointer-events-auto hover:bg-white/[0.12] hover:border-white/25 hover:shadow-[0_60px_120px_-25px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:scale-[1.01] overflow-hidden">
          
          {/* Ambient Glass Sheen Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent pointer-events-none z-0" />
          
          <div className="relative z-10 w-full flex flex-col">
            
            {/* Logo, Header, and Pulsing Live Badge */}
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                {/* Neutral Glass Map-Pin Icon */}
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-white/10 border border-white/20 shadow-lg">
                  <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-black tracking-tight text-white select-none">ParkSense AI</h1>
              </div>
              
              {/* Live Badge */}
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 border border-white/10">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/80 select-none">Bengaluru · Live</span>
              </div>
            </div>

            {/* Mode Selector Segmented Toggle */}
            <div className="mb-3.5 flex rounded-2xl bg-white/[0.04] p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setMode('user')}
                className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  mode === 'user' 
                    ? 'border border-white/25 text-white bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Citizen
              </button>
              <button
                type="button"
                onClick={() => setMode('officer')}
                className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  mode === 'officer' 
                    ? 'border border-white/25 text-white bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-sm' 
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Officer
              </button>
            </div>

            {/* Subtext description */}
            <p className="mb-3.5 text-center text-xs text-white/70 font-semibold select-none leading-relaxed px-1">
              {mode === 'user' 
                ? 'Plan your commute — see congestion and parking hotspots before you travel.'
                : 'Command center access for Bengaluru traffic enforcement.'}
            </p>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 select-none">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 transition-all duration-300 placeholder-white/30"
                  placeholder={mode === 'officer' ? 'officer@parksense.demo' : 'you@email.com'}
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 select-none">Password</label>
                  <button 
                    type="button" 
                    className="text-[9px] font-bold text-white/50 hover:text-white hover:underline cursor-pointer bg-transparent border-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10 transition-all duration-300"
                  />
                  {/* Visibility eye toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-4.5 w-4.5 text-white/45 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4.5 w-4.5 text-white/45 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
                className="w-full rounded-xl bg-white py-2.5 font-bold uppercase text-[11px] tracking-widest text-black hover:bg-white/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer shadow-[0_8px_24px_rgba(255,255,255,0.15)] mt-2"
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
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Sign in with Google</span>
                <span className="text-[10px] text-white/40 font-normal">(Citizen OAuth)</span>
              </a>
            )}

            {/* Demo Credentials Filler */}
            <button
              type="button"
              onClick={fillDemo}
              className="mt-3 w-full text-center text-xs text-white/60 hover:text-white hover:underline cursor-pointer bg-transparent border-none outline-none select-none font-bold transition-colors duration-200"
            >
              Use demo {mode} credentials
            </button>

            {/* Citizen register link */}
            {mode === 'user' && (
              <p className="mt-3 text-center text-xs text-white/55 select-none">
                New here?{' '}
                <Link to="/register" className="text-white hover:underline font-bold transition-colors duration-200">
                  Create account
                </Link>
              </p>
            )}

          </div>
        </div>
      </div>

      {/* Floating Glass Status/Stats Bar at Bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-[420px] px-4 select-none pointer-events-auto">
        <div className="flex items-center justify-around rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5 text-white shadow-[0_15px_35px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-xl">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
            <span className="text-[9px] text-white/60 font-bold uppercase tracking-wider">Violations</span>
            <span className="text-xs text-red-400 font-black">791+</span>
          </div>
          <div className="h-4 w-px bg-white/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
            </span>
            <span className="text-[9px] text-white/60 font-bold uppercase tracking-wider">Active Zones</span>
            <span className="text-xs text-green-400 font-black">6</span>
          </div>
          <div className="h-4 w-px bg-white/10"></div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-teal-500"></span>
            </span>
            <span className="text-[9px] text-white/60 font-bold uppercase tracking-wider">Forecast</span>
            <span className="text-xs text-teal-400 font-black">24h</span>
          </div>
        </div>
      </div>

      <ChatBot context="login" />

    </div>
  );
}

