import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/predict', label: 'Predict', icon: '◎' },
  { to: '/analytics', label: 'Analytics', icon: '▤' },
  { to: '/corridors', label: 'Corridors', icon: '⬡' },
];

export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-command-border bg-command-panel">
      <div className="border-b border-command-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-command-accent text-lg font-bold text-white">
            P
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">ParkSense AI</h1>
            <p className="text-xs text-command-muted">Bengaluru Command Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
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
          <p className="text-xs font-medium text-command-muted">Live Status</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-command-success" />
            <span className="text-xs text-gray-300">System Operational</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
