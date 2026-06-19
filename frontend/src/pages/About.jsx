import React from 'react';

export default function About() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeIn">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">About ParkSense AI</h2>
        <p className="text-sm text-command-muted leading-relaxed">
          The next-generation, AI-driven parking congestion intelligence platform for Bengaluru.
        </p>
      </div>

      {/* Main Glass Panel */}
      <div className="rounded-2xl border border-command-border bg-command-panel p-6 md:p-8 shadow-xl space-y-6">
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🎯</span> Our Mission
          </h3>
          <p className="text-sm text-gray-300 leading-relaxed">
            Bengaluru loses crores daily to traffic congestion caused by illegal, double, or wrong-side parking. 
            <strong> ParkSense AI</strong> was designed to transition city parking enforcement from reactive complaint-handling 
            to proactive intelligence-led operations. We analyze historical data, live sensor streams, and CCTV feeds 
            to calculate where violations will occur next, their exact economic costs, and where to deploy enforcement officers.
          </p>
        </section>

        <hr className="border-white/10" />

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🚗</span> For Citizens
            </h3>
            <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
              <li><strong>Trip Planner:</strong> Check live zone speeds, delay indexes, and predicted parking congestion scores before leaving.</li>
              <li><strong>Live Violation Reporter:</strong> Submit parking violation reports with vehicle photos and locations. Connected via WebSockets for real-time dispatch.</li>
              <li><strong>Green Corridors:</strong> Safe zones and priority alerts keeping emergency lanes clear for ambulances.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>👮</span> For Officers & Administration
            </h3>
            <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
              <li><strong>ParkPredict Engine:</strong> 24-hour Prophet-based forecast modeling congestion trends.</li>
              <li><strong>Patrol Shift Planner:</strong> AI-driven optimal officer assignment schedules targeting high-probability violation hotspots.</li>
              <li><strong>CCTV Monitor:</strong> Real-time automated street surveillance detecting double-parking and loading-dock violations instantly.</li>
              <li><strong>Economic Impact Ledger:</strong> Quantifies fuel burned, emissions produced, and wage value lost per sector.</li>
            </ul>
          </div>
        </section>

        <hr className="border-white/10" />

        <section className="space-y-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Technology Stack
          </h3>
          <div className="flex flex-wrap gap-2">
            {['FastAPI', 'React 19', 'Vite', 'Tailwind CSS', 'Prophet (Meta)', 'Pandas & NumPy', 'Leaflet Engine', 'WebSockets'].map((tech) => (
              <span key={tech} className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-white">
                {tech}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
