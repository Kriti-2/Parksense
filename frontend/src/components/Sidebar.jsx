import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DashboardIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const PredictIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
  </svg>
);

const CorridorsIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2l6 3 6-3 3 1.5v10.764a1 1 0 01-.553.894L15 20l-6-3-6 3z" />
  </svg>
);

const ShiftIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const MonitorIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const officerNav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/predict', label: 'Predict', icon: <PredictIcon /> },
  { to: '/analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
  { to: '/corridors', label: 'Corridors', icon: <CorridorsIcon /> },
  { to: '/shift-planner', label: 'Shift Planner', icon: <ShiftIcon /> },
  { to: '/monitor', label: 'CCTV Monitor', icon: <MonitorIcon /> },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <>
      {/* Backdrop overlay on Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-command-border bg-command-panel shadow-lg transition-transform duration-300 md:static md:translate-x-0 md:shadow-sm ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header */}
        <div className="border-b border-command-border px-6 py-6 bg-gradient-to-r from-white via-command-bg/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-command-accent text-white font-extrabold text-xl shadow-md shadow-command-accent/20 border border-command-accent/25 animate-pulse">
              P
            </div>
            <div>
              <h1 className="text-base font-extrabold text-gray-800 tracking-tight leading-none">ParkSense AI</h1>
              <p className="text-[10px] font-bold text-command-muted mt-1.5 uppercase tracking-widest">Command Center</p>
            </div>
          </div>
          {/* Close button on mobile */}
          <button 
            type="button" 
            onClick={onClose} 
            className="md:hidden rounded-lg p-1.5 hover:bg-command-bg text-command-muted hover:text-command-accent cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1.5 px-3 py-6">
          {officerNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose} // Auto-close on link click on mobile
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-bold transition-all duration-200 relative group cursor-pointer ${
                  isActive
                    ? 'bg-command-accent/10 text-command-accent shadow-sm border-l-4 border-l-command-accent pl-2.5'
                    : 'text-command-muted hover:bg-command-bg/70 hover:text-command-accent hover:translate-x-1.5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Icon wrapper with custom colored background on active */}
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all duration-200 ${
                    isActive
                      ? 'bg-command-accent text-white border-command-accent/30 shadow-sm shadow-command-accent/10'
                      : 'bg-white text-command-muted border-command-border group-hover:border-command-accent/40 group-hover:text-command-accent group-hover:scale-105'
                  }`}>
                    {item.icon}
                  </div>
                  <span className="tracking-wide">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Profile Block */}
        <div className="border-t border-command-border px-4 py-4 bg-command-bg/20">
          <div className="rounded-2xl border border-command-border bg-white p-4 shadow-sm transition-all duration-200 hover:border-command-accent/30 hover:shadow-md">
            <div className="flex items-center gap-2.5">
              {/* User avatar badge */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-command-accent/10 text-command-accent font-extrabold text-sm border border-command-accent/10">
                {user?.full_name?.charAt(0).toUpperCase() || 'O'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-command-muted leading-none">Signed in as</p>
                <p className="mt-1.5 truncate text-xs font-bold text-gray-800 leading-tight">{user?.full_name}</p>
                <p className="truncate text-[10px] text-command-muted mt-0.5">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3.5 w-full rounded-xl border border-command-border py-2 text-[10px] font-bold text-gray-600 hover:bg-command-danger/5 hover:text-command-danger hover:border-command-danger/25 transition-all duration-200 cursor-pointer uppercase tracking-wider"
            >
              Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
