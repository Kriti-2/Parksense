import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-command-bg transition-colors duration-300">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-command-border bg-command-panel px-8 py-5 shadow-sm transition-colors duration-300">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-command-accent/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-command-accent uppercase">
              Bengaluru Traffic Control
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-gray-800">Parking Congestion Intelligence</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-command-muted">
            <ThemeToggle />
            <span className="flex items-center gap-1.5 border border-command-border bg-command-panel px-3 py-1.5 rounded-xl shadow-sm">
              <span className="h-2 w-2 rounded-full bg-command-success animate-pulse"></span>
              Live Feed
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-command-bg transition-colors duration-300">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
