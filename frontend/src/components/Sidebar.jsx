import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const officerNav = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/predict', label: 'Predict', icon: '◎' },
  { to: '/analytics', label: 'Analytics', icon: '▤' },
  { to: '/corridors', label: 'Corridors', icon: '⬡' },
  { to: '/shift-planner', label: 'Shift Planner', icon: '📅' },
  { to: '/reporter', label: 'Live Reporter', icon: '⚡' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-command-border bg-command-panel">
      <div className="border-b border-command-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-command-accent text-lg font-bold text-white">
            P
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">ParkSense AI</h1>
            <p className="text-xs text-command-muted">Officer Command Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {officerNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-command-accent/15 text-command-accent'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-command-border px-4 py-4">
        <div className="rounded-lg bg-command-bg p-3">
          <p className="text-xs font-medium text-command-muted">Signed in as</p>
          <p className="mt-1 truncate text-sm font-medium text-white">{user?.full_name}</p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 w-full rounded-md border border-command-border py-1.5 text-xs text-gray-400 hover:text-white"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
