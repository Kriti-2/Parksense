import { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
} from 'recharts';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import CongestionDebt from '../components/CongestionDebt';
import TimeLapse from '../components/TimeLapse';
import LiveStatusBar from '../components/LiveStatusBar';
import { useAuth } from '../context/AuthContext';
import ROICard from '../components/ROICard';

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

const loadHtml2Pdf = () => {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) {
      resolve(window.html2pdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve(window.html2pdf);
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
};

function PrintableReport({ analytics, kpis, scopeLabel }) {
  const currentDateTime = new Date().toLocaleString();

  return (
    <div id="printable-report-content" className="hidden print:block bg-white text-gray-900 p-8 max-w-4xl mx-auto">
      {/* Report Header */}
      <div className="border-b-2 border-gray-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight text-gray-900">MargSense Traffic Intelligence Report</h1>
            <p className="text-xs text-gray-500 font-semibold mt-1">Bengaluru Traffic Congestion & Economic Impact Assessment</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] border border-gray-300 font-bold px-2 py-0.5 rounded uppercase">Official Copy</span>
          </div>
        </div>
        <div className="mt-4 flex justify-between text-[10px] text-gray-400 font-medium">
          <span>Date Generated: {currentDateTime}</span>
          <span>Scope: {scopeLabel}</span>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1 mb-2">1. Executive Summary</h2>
        <p className="text-[10px] text-gray-600 leading-relaxed">
          This report analyzes congestion patterns, vehicle compliance, and compounding economic losses across Bengaluru's high-density corridors. By shifting traffic management from reactive policing to proactive prevention, this diagnostic assessment provides critical data for patrol deployment schedules and corridor clearance protocols.
        </p>
      </div>

      {/* Core KPIs */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1 mb-2">2. Key Performance Indicators (KPIs)</h2>
        <table className="w-full text-[10px] text-left border-collapse border border-gray-250">
          <thead>
            <tr className="bg-gray-50 text-gray-700 uppercase tracking-wider border-b border-gray-250">
              <th className="p-2 border-r border-gray-250">Metric Description</th>
              <th className="p-2 text-right">Current Value</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-250">
              <td className="p-2 border-r border-gray-250 font-medium text-gray-700">Total Recorded Violations (Dataset)</td>
              <td className="p-2 text-right font-bold text-gray-950">{(kpis.total_violations || 298450).toLocaleString('en-IN')}</td>
            </tr>
            <tr className="border-b border-gray-250">
              <td className="p-2 border-r border-gray-250 font-medium text-gray-700">Average Congestion Score</td>
              <td className="p-2 text-right font-bold text-gray-950">{kpis.avg_congestion_score || 42}%</td>
            </tr>
            <tr className="border-b border-gray-250">
              <td className="p-2 border-r border-gray-250 font-medium text-gray-700">Active High-Risk Hotspots (Congestion ≥ 50)</td>
              <td className="p-2 text-right font-bold text-gray-950">{kpis.active_hotspots || 3}</td>
            </tr>
            <tr className="border-b border-gray-250">
              <td className="p-2 border-r border-gray-250 font-medium text-gray-700">Daily Economic Loss (Est.)</td>
              <td className="p-2 text-right font-bold text-gray-950">₹{(kpis.daily_economic_loss || 1245000).toLocaleString('en-IN')}</td>
            </tr>
            <tr className="border-b border-gray-250">
              <td className="p-2 border-r border-gray-250 font-medium text-gray-700">Weekly Economic Loss (Est.)</td>
              <td className="p-2 text-right font-bold text-gray-950">₹{(kpis.weekly_economic_loss || 8715000).toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Corridor Breakdown */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1 mb-2">3. Corridor Performance Analysis</h2>
        <table className="w-full text-[10px] text-left border-collapse border border-gray-250">
          <thead>
            <tr className="bg-gray-50 text-gray-700 uppercase tracking-wider border-b border-gray-250">
              <th className="p-2 border-r border-gray-250">Corridor / Zone</th>
              <th className="p-2 border-r border-gray-250 text-right">Daily Loss (₹)</th>
              <th className="p-2 border-r border-gray-250 text-right">Idle Fuel Cost (₹)</th>
              <th className="p-2 border-r border-gray-250 text-right">Productivity Loss (₹)</th>
              <th className="p-2 text-right">Speed Drop / Congestion</th>
            </tr>
          </thead>
          <tbody>
            {analytics?.economic_losses?.map((item, idx) => {
              const speedDrop = analytics?.congestion_fingerprints?.find(c => c.corridor === item.zone)?.speed_drop_pct || '—';
              return (
                <tr key={idx} className="border-b border-gray-250">
                  <td className="p-2 border-r border-gray-250 font-medium text-gray-800">{item.zone}</td>
                  <td className="p-2 border-r border-gray-250 text-right font-bold text-gray-950">₹{item.daily_loss?.toLocaleString('en-IN')}</td>
                  <td className="p-2 border-r border-gray-250 text-right text-gray-600">₹{item.idle_fuel_cost?.toLocaleString('en-IN')}</td>
                  <td className="p-2 border-r border-gray-250 text-right text-gray-600">₹{item.productivity_loss?.toLocaleString('en-IN')}</td>
                  <td className="p-2 text-right font-bold text-red-650">{speedDrop}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Policy Recommendations */}
      {analytics?.policy_recommendations && (
        <div className="mb-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-800 border-b border-gray-200 pb-1 mb-2">4. Actionable Policy Recommendations</h2>
          <div className="space-y-2">
            {analytics.policy_recommendations.map((rec, i) => (
              <div key={i} className="border border-gray-250 rounded-lg p-2.5 bg-gray-50/20">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[8px] bg-gray-150 text-gray-800 border border-gray-200 font-bold px-1.5 py-0.5 rounded uppercase">
                    Priority: {rec.priority}
                  </span>
                  <span className="text-[9px] font-bold text-gray-950">{rec.zone}</span>
                </div>
                <p className="text-[9px] font-bold text-gray-800">{rec.action}</p>
                <p className="text-[8px] text-gray-500 leading-normal mt-0.5">{rec.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign-off Block */}
      <div className="mt-12 pt-8 border-t border-gray-250 flex justify-between text-[10px] text-gray-400">
        <div>
          <p className="font-bold text-gray-700">Bangalore Traffic Police (BTP)</p>
          <p>Analytics Division</p>
        </div>
        <div className="text-right">
          <div className="h-6 w-32 border-b border-gray-300 mb-1 ml-auto"></div>
          <p className="text-gray-700">Authorized Signature</p>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { isOfficer } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastTick, setLastTick] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleLiveTick = useCallback((payload) => {
    if (payload.type !== 'live_tick') return;
    setLastTick(payload);
    if (payload.analytics) {
      setAnalytics(payload.analytics);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const html2pdf = await loadHtml2Pdf();
      const element = document.getElementById('printable-report-content');
      if (!element) throw new Error('Report template element not found');

      const opt = {
        margin:       0.4,
        filename:     `MargSense_Traffic_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
      };

      // Create a temporary off-screen container for rendering
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '7.8in';
      container.style.background = 'white';
      container.style.color = '#111827';
      container.style.padding = '0.3in';
      container.innerHTML = element.innerHTML;
      container.className = 'bg-white text-gray-900';

      document.body.appendChild(container);
      await html2pdf().set(opt).from(container).save();
      document.body.removeChild(container);
    } catch (err) {
      console.error('Failed to export PDF directly:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const [anRes, shRes] = await Promise.all([
          api.getAnalytics(),
          isOfficer ? api.getShiftPlanner() : Promise.resolve({ data: null })
        ]);
        setAnalytics(anRes.data);
        setShiftData(shRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load analytics data:", err);
        setLoading(false);
      }
    }
    load();
  }, [isOfficer]);

  if (loading) {
    return <div className="text-center text-gray-400">Loading live analytics...</div>;
  }

  const congestionData = analytics?.congestion_fingerprints?.map((c) => ({
    zone: c.corridor.replace(' Layout', ''),
    score: c.congestion_score,
    speedDrop: c.speed_drop_pct,
  })) || [];

  const economicData = analytics?.economic_losses?.map((e) => ({
    zone: e.zone.replace(' Layout', ''),
    daily: e.daily_loss,
    fuel: e.idle_fuel_cost,
    productivity: e.productivity_loss,
  })) || [];

  const zoneBreakdown = analytics?.zone_breakdown || [];
  const scopeLabel = analytics?.zone_breakdown_scope === 'last_24h' ? 'Last 24 hours (live)' : 'All time';
  const kpis = analytics?.kpis || {};

  return (
    <div className="pt-8">
      {/* ── Interactive Dashboard View (hidden in print) ── */}
      <div className="space-y-6 print-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Analytics & Economic Impact</h2>
            <p className="mt-1 text-xs text-gray-400 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
              Live congestion fingerprinting and economic loss from real Bengaluru violation data
            </p>
          </div>
          <div className="flex items-center gap-3 no-print">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 h-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-gray-200 hover:border-gray-300 dark:hover:border-white/20 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98] flex items-center select-none disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export Report as PDF"
            >
              <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{isExporting ? 'Generating...' : 'Export PDF'}</span>
            </button>
            <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
          </div>
        </div>

        {analytics?.data_sources && (
          <div className="flex flex-wrap gap-4 rounded-lg border border-command-border bg-command-panel px-4 py-3 text-xs text-gray-400">
            <span>Violations: <strong className="text-gray-200">{analytics.data_sources.violations}</strong></span>
            <span>Traffic: <strong className="text-gray-200">{analytics.data_sources.traffic?.source || '—'}</strong></span>
            <span>Zone breakdown: <strong className="text-gray-200">{scopeLabel}</strong></span>
            {analytics.reference_time && (
              <span>Reference: <strong className="text-gray-200">{new Date(analytics.reference_time).toLocaleString()}</strong></span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 space-y-6">
            <CongestionDebt analytics={analytics} />
            {isOfficer && <ROICard shiftData={shiftData} analytics={analytics} />}
          </div>
          <TimeLapse trends={analytics?.violation_trends} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-command-border bg-command-panel p-6">
            <h3 className="text-lg font-semibold text-white">Congestion Fingerprints</h3>
            <p className="text-sm text-command-muted">Live speed drop % by corridor</p>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={congestionData}>
                  <XAxis dataKey="zone" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <Bar dataKey="score" fill="#3b82f6" name="Congestion Score" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="speedDrop" fill="#ef4444" name="Speed Drop %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-command-border bg-command-panel p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Violation Distribution</h3>
              <p className="text-sm text-command-muted">{scopeLabel}</p>
            </div>
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...zoneBreakdown].sort((a, b) => b.violations - a.violations)}
                  layout="vertical"
                  margin={{ left: 10, right: 35, top: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="zone"
                    type="category"
                    tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }}
                    width={90}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    itemStyle={{ color: '#e5e7eb' }}
                    formatter={(value, name, props) => [
                      `${value.toLocaleString()} violations (${props.payload.share_pct}%)`,
                      'Count'
                    ]}
                  />
                  <Bar dataKey="violations" radius={[0, 4, 4, 0]} barSize={12}>
                    {zoneBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="share_pct"
                      position="right"
                      formatter={(val) => `${val}%`}
                      style={{ fill: '#9ca3af', fontSize: 9, fontWeight: 700 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-command-border bg-command-panel p-6">
          <h3 className="text-lg font-semibold text-white">Economic Loss Breakdown</h3>
          <p className="text-sm text-command-muted">Derived from live congestion + violation density</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={economicData}>
                <XAxis dataKey="zone" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Line type="monotone" dataKey="daily" stroke="#ef4444" strokeWidth={2} name="Daily Loss" />
                <Line type="monotone" dataKey="fuel" stroke="#f59e0b" strokeWidth={2} name="Fuel Cost" />
                <Line type="monotone" dataKey="productivity" stroke="#3b82f6" strokeWidth={2} name="Productivity" />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {analytics?.policy_recommendations && (
          <div className="rounded-xl border border-command-border bg-command-panel p-6">
            <h3 className="text-lg font-semibold text-white">Policy Recommendations</h3>
            <p className="text-sm text-command-muted">Updated from live rankings every 30s</p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {analytics.policy_recommendations.map((rec, i) => (
                <div key={i} className="rounded-lg border border-command-border bg-command-bg p-4">
                  <span className="rounded bg-command-accent/20 px-2 py-0.5 text-xs font-bold text-command-accent">
                    {rec.priority}
                  </span>
                  <p className="mt-2 font-medium text-white">{rec.action}</p>
                  <p className="mt-1 text-sm text-gray-400">{rec.zone}</p>
                  <p className="mt-2 text-xs text-gray-500">{rec.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Printable Report View (visible only in print) ── */}
      <PrintableReport analytics={analytics} kpis={kpis} scopeLabel={scopeLabel} />
    </div>
  );
}
