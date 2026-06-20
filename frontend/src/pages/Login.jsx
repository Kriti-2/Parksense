import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatBot from '../components/ChatBot';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  


  const [mode, setMode] = useState('user'); // Toggle: 'user' (Citizen) vs 'officer' (Officer Command)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);



  // Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('margsense_theme', 'light');
  }, []);

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
      setEmail('officer@margsense.demo');
      setPassword('officer123');
    } else {
      setEmail('user@margsense.demo');
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
        className="hidden sm:block fixed inset-0 z-0 h-full w-full object-cover transform-gpu will-change-[filter] transition-all duration-500 brightness-[0.45] contrast-[1.05]"
      >
        <source src="/traffic_video/12926930_3840_2160_60fps.mp4" type="video/mp4" />
      </video>

      {/* Mobile Video Background (Brighter, Hidden on Desktop) */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="block sm:hidden fixed inset-0 z-0 h-full w-full object-cover transform-gpu will-change-[filter] transition-all duration-500 brightness-[0.52] contrast-[1.05]"
      >
        <source src="/traffic_video/12926930_3840_2160_60fps.mp4" type="video/mp4" />
      </video>

      {/* Centered High-Fidelity Login Card (GPU accelerated to avoid lag over 4K video) */}
      <div className="z-10 flex items-center justify-center px-4 w-full pointer-events-none">
        <div className="relative w-full max-w-[360px] rounded-3xl border border-white/20 bg-white/[0.08] px-6 py-6.5 text-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-3xl backdrop-saturate-200 transition-all duration-300 transform-gpu will-change-transform pointer-events-auto hover:bg-white/[0.12] hover:border-white/25 hover:shadow-[0_60px_120px_-25px_rgba(0,0,0,0.85),inset_0_1px_0_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.12)] hover:scale-[1.01] overflow-hidden">
          
          {/* Ambient Glass Sheen Overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent pointer-events-none z-0" />
          
          <div className="relative z-10 w-full flex flex-col">
            
            {/* Logo, Header, and Pulsing Live Badge */}
            <div className="mb-4 flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <img src="/logo.png" alt="Logo" className="h-10 w-10 object-contain rounded-xl" />
                <h1 className="text-xl font-black tracking-tight text-white select-none">मार्ग Sense</h1>
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
                  placeholder={mode === 'officer' ? 'officer@margsense.demo' : 'you@email.com'}
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

