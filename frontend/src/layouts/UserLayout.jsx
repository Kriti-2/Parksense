import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useState, useCallback } from 'react';
import NoticesBanner from '../components/NoticesBanner';
import ChatBot from '../components/ChatBot';
import { useTranslation, LanguageSelector } from '../context/LanguageContext';
import Footer from '../components/Footer';

const USER_NAV = [
  { to: '/', key: 'home', end: true },
  { to: '/congestion', key: 'tripPlanner' },
  { to: '/reporter', key: 'reportViolation' },
  { to: '/about', key: 'about' },
];

export default function UserLayout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lastTick, setLastTick] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick') setLastTick(payload);
  }, []);

  const { connected } = useLiveFeed(handleLiveTick);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#EFEFEA] dark:bg-gray-950 transition-colors duration-300">
      <NoticesBanner />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/98 dark:bg-gray-950/98 border-b border-gray-100 dark:border-white/10 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 gap-4">

          {/* Logo + Branding */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.png" alt="Logo" className="h-9 w-9 object-contain rounded-lg dark:bg-white dark:p-0.5" />
            <div className="leading-tight">
              <div className="text-[15px] font-bold text-gray-900 dark:text-white">{t('appTitle')}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium hidden sm:block">{t('tagline')}</div>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {USER_NAV.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `relative px-3.5 py-2 text-sm font-semibold transition-colors duration-150 cursor-pointer rounded-md ${
                    isActive
                      ? 'text-[#5E8599] dark:text-[#5E8599]'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {t(link.key)}
                    {isActive && (
                      <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-[#5E8599] rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#5E8599] transition-colors cursor-pointer"
            >
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-[#8A9E85] animate-pulse' : 'bg-gray-300'}`} />
              {t('liveFeed')}
            </Link>
            <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />
            <LanguageSelector />
            <div className="h-4 w-px bg-gray-200 dark:bg-white/10" />

            {/* Profile */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {(user?.full_name || 'C')[0].toUpperCase()}
                </div>
                <span className="text-sm font-semibold text-gray-800 dark:text-white">
                  {user?.full_name?.split(' ')[0] || 'Citizen'}
                </span>
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 shadow-lg py-1 z-50 animate-fadeIn">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-white/10">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user?.full_name || 'Citizen'}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user?.email || 'citizen@margsense.in'}</p>
                  </div>
                  <button
                    onClick={() => { setProfileOpen(false); handleLogout(); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-b-xl cursor-pointer"
                  >
                    {t('signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-white/10 bg-white dark:bg-gray-950 px-4 py-3 space-y-1 animate-fadeIn flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/10">
              <span className="text-xs font-bold text-gray-500 uppercase">{t('citizen')}</span>
              <LanguageSelector />
            </div>
            {USER_NAV.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EBF2F5] dark:bg-[#5E8599]/10 text-[#5E8599] dark:text-[#5E8599]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                  }`
                }
              >
                {t(link.key)}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-semibold text-red-500 hover:text-red-600 cursor-pointer"
              >
                {t('signOut')}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="mx-auto max-w-7xl w-full px-4 md:px-6 pb-8 flex-1">
          {children || <Outlet />}
        </div>
        <Footer />
      </main>

      <ChatBot context="citizen" />
    </div>
  );
}
