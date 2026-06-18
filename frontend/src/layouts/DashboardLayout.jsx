import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-command-bg">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 justify-between border-b border-command-border bg-command-panel px-6 md:px-8 py-5 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger button on mobile */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden rounded-lg p-2 hover:bg-command-bg text-command-muted hover:text-command-accent cursor-pointer border border-command-border bg-white flex items-center justify-center"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-command-accent/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-command-accent uppercase">
                Bengaluru Traffic Control
              </div>
              <h2 className="mt-1.5 text-base md:text-xl font-bold text-gray-800 leading-tight">Parking Congestion Intelligence</h2>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-command-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-command-success animate-pulse"></span>
              <span className="hidden sm:inline">Live Feed</span>
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
