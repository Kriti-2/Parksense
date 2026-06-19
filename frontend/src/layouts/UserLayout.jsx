import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useState, useCallback } from 'react';
import LiveStatusBar from '../components/LiveStatusBar';
import NoticesBanner from '../components/NoticesBanner';
import ThemeToggle from '../components/ThemeToggle';
import ChatBot from '../components/ChatBot';

export default function UserLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [lastTick, setLastTick] = useState(null);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick') {
      setLastTick(payload);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-command-bg transition-colors duration-300">
      <NoticesBanner />
      <header className="border-b border-command-border bg-command-panel px-6 py-4 transition-colors duration-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-command-accent text-lg font-bold text-white">
              P
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ParkSense — Citizen Portal</h1>
              <p className="text-xs text-command-muted">
                Hi {user?.full_name || 'Citizen'}, plan your commute and report parking congestion.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <nav className="flex gap-2 rounded-xl bg-command-bg p-1.5 border border-command-border/50 transition-colors duration-300">
              <NavLink
                to="/congestion"
                className={({ isActive }) =>
                  `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200 ${
                    isActive ? 'bg-command-accent text-white shadow-sm' : 'text-gray-500 hover:bg-command-border/50 hover:text-command-accent'
                  }`
                }
              >
                Trip Planner
              </NavLink>
              <NavLink
                to="/reporter"
                className={({ isActive }) =>
                  `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200 ${
                    isActive ? 'bg-command-accent text-white shadow-sm' : 'text-gray-500 hover:bg-command-border/50 hover:text-command-accent'
                  }`
                }
              >
                Report Violation
              </NavLink>
              <NavLink
                to="/corridors"
                className={({ isActive }) =>
                  `rounded-lg px-4 py-1.5 text-xs font-bold transition-all duration-200 ${
                    isActive ? 'bg-command-accent text-white shadow-sm' : 'text-gray-500 hover:bg-command-border/50 hover:text-command-accent'
                  }`
                }
              >
                Emergency Corridors
              </NavLink>
            </nav>

            <ThemeToggle />
            <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
            
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-command-border bg-command-panel px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-command-border hover:text-command-accent hover:border-command-accent/20 transition-all duration-200 cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        {children || <Outlet />}
      </main>
      <ChatBot context="citizen" />
    </div>
  );
}
