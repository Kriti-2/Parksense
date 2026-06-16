import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-command-bg">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-command-border bg-command-panel px-8 py-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-command-muted">Flipkart Gridlock Hackathon</p>
            <h2 className="text-xl font-semibold text-white">Parking Congestion Intelligence</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Bengaluru, KA</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
