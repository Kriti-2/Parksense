import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import KPICard from '../components/KPICard';
import LiveStatusBar from '../components/LiveStatusBar';
import EnforcementBrief from '../components/EnforcementBrief';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, LayersControl, LayerGroup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function formatINR(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount?.toLocaleString('en-IN') || 0}`;
}

const PRIORITY_BADGES = {
  CRITICAL: 'bg-command-danger/25 text-command-danger border border-command-danger/30',
  HIGH: 'bg-command-warning/25 text-command-warning border border-command-warning/30',
  MEDIUM: 'bg-command-accent/25 text-command-accent border border-command-accent/30',
  LOW: 'bg-gray-500/15 text-gray-500 border border-gray-500/20',
};

const SHIFT_BADGES = {
  Morning: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  Evening: 'bg-purple-500/10 text-purple-500 border border-purple-500/20',
};

const BENGALURU_CENTER = [12.9716, 77.5946];
const MAPMYINDIA_KEY = import.meta.env.VITE_MAPMYINDIA_API_KEY || '';

function MapController({ selectedOfficer, officers }) {
  const map = useMap();
  useEffect(() => {
    if (selectedOfficer) {
      const officer = officers.find((o) => o.id === selectedOfficer);
      if (officer && officer.lat && officer.lng) {
        map.setView([officer.lat, officer.lng], 14, { animate: true });
      }
    }
  }, [selectedOfficer, officers, map]);
  return null;
}

export default function ShiftPlannerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastTick, setLastTick] = useState(null);

  // Consolidated Dashboard States
  const [predictions, setPredictions] = useState(null);
  const [corridors, setCorridors] = useState(null);
  const [severity, setSeverity] = useState(null);
  const [recidivism, setRecidivism] = useState(null);

  // Shift & deployment planning states
  const [selectedShift, setSelectedShift] = useState('Morning'); // Default to Morning shift
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [allocations, setAllocations] = useState({}); // { "zone-slot": officerCount }
  const [toast, setToast] = useState(null);

  // Real-Time Tactical Command States
  const [activeTab, setActiveTab] = useState('strategic');
  const [officers, setOfficers] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [autoDispatch, setAutoDispatch] = useState(false);
  const [autoDispatchLoading, setAutoDispatchLoading] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'tactical' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dispatchLogs, activeTab]);

  const poolLimit = 16; // 16 max officers available for scheduling
  const slots = useMemo(() => {
    return selectedShift === 'Morning'
      ? ["06:00 - 08:00", "08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00"]
      : ["14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00"];
  }, [selectedShift]);

  // Fetch shift planner data and other consolidated operational stats
  const loadShiftData = useCallback(async () => {
    try {
      const [shRes, prRes, coRes, seRes, reRes, offRes] = await Promise.all([
        api.getShiftPlanner(),
        api.getPredictions(),
        api.getCorridors(),
        api.getSeverityQueue(20),
        api.getRecidivism(),
        api.getOfficers()
      ]);

      const resData = shRes.data;
      setData(resData);
      setPredictions(prRes.data);
      setCorridors(coRes.data);
      setSeverity(seRes.data);
      setRecidivism(reRes.data);
      setOfficers(offRes.data.officers || []);
      setDispatchLogs(offRes.data.dispatch_logs || []);
      setAutoDispatch(offRes.data.auto_dispatch || false);
      
      // Initialize allocations state matching initial recommendations
      const initial = {};
      const assignments = resData?.assignments || [];
      assignments.forEach((a) => {
        const zoneSlots = a.shift === 'Morning'
          ? ["06:00 - 08:00", "08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00"]
          : ["14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00"];
        
        const rec = a.officers_recommended || 0;
        if (rec > 0) {
          // Pre-fill slot 1 & 2
          initial[`${a.zone}-${zoneSlots[1]}`] = Math.min(rec, 2);
          if (rec > 2) {
            initial[`${a.zone}-${zoneSlots[2]}`] = rec - 2;
          }
        }
      });
      setAllocations(initial);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch shift planner data:', err);
      setError('Could not fetch deployment planning data.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up live feed to auto-refresh on live tick
  const handleLiveTick = useCallback((payload) => {
    if (payload.type === 'live_tick') {
      setLastTick(payload);
      if (payload.corridors) setCorridors(payload.corridors);
      if (payload.severity_queue) {
        setSeverity((prev) => ({
          ...(prev || {}),
          queue: payload.severity_queue,
          summary: payload.severity_summary,
          generated_at: payload.timestamp,
        }));
      }
      if (payload.officers) setOfficers(payload.officers);
      if (payload.dispatch_logs) setDispatchLogs(payload.dispatch_logs);
      if (payload.auto_dispatch !== undefined) setAutoDispatch(payload.auto_dispatch);
    }
  }, []);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Alert Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const assignments = data?.assignments || [];
  const summary = data?.summary || {};

  // Filter zones for the active shift
  const activeZones = useMemo(() => {
    return assignments.filter((a) => {
      const shiftMatch = a.shift === selectedShift;
      const priorityMatch = selectedPriority === 'All' || a.priority === selectedPriority;
      return shiftMatch && priorityMatch;
    });
  }, [assignments, selectedShift, selectedPriority]);

  // Compute live statistics based on current grid allocations
  const { complianceScore, totalDeployed } = useMemo(() => {
    let scoreSum = 0;
    let cellCount = 0;
    let deployed = 0;
    const priorityWeights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    activeZones.forEach((a) => {
      const req = priorityWeights[a.priority] || 2;
      slots.forEach((slot) => {
        const count = allocations[`${a.zone}-${slot}`] || 0;
        deployed += count;

        let cellCompliance = 20; // base compliance for unpatrolled slot
        if (count > 0) {
          cellCompliance = Math.min(95, Math.round(20 + (count / req) * 75));
        }
        scoreSum += cellCompliance;
        cellCount++;
      });
    });

    const average = cellCount > 0 ? Math.round(scoreSum / cellCount) : 0;
    return { complianceScore: average, totalDeployed: deployed };
  }, [activeZones, slots, allocations]);

  // Handle cell click (cycles officer count: 0 -> 1 -> 2 -> 3 -> 4 -> 0)
  const handleCellClick = (zone, slot) => {
    const key = `${zone}-${slot}`;
    const current = allocations[key] || 0;
    const next = (current + 1) % 5;

    // Check pool limit constraint before adding staff
    const diff = next - current;
    if (totalDeployed + diff > poolLimit) {
      showToast('Staff Pool Limit Exceeded! Maximum 16 officers on duty.', 'error');
      return;
    }

    setAllocations((prev) => ({
      ...prev,
      [key]: next,
    }));
  };

  // Automated smart-dispatch algorithm
  const handleSmartOptimize = () => {
    const nextAlloc = {};
    let totalUsed = 0;
    const priorityWeights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    // Sort active zones by priority ranking
    const sortedZones = [...activeZones].sort(
      (a, b) => priorityWeights[b.priority] - priorityWeights[a.priority]
    );

    sortedZones.forEach((zone) => {
      const req = priorityWeights[zone.priority] || 2;
      const busiestSlots = [slots[1], slots[2]]; // Core peak slots

      busiestSlots.forEach((slot) => {
        if (totalUsed < poolLimit) {
          const deployVal = Math.min(req, poolLimit - totalUsed);
          nextAlloc[`${zone.zone}-${slot}`] = deployVal;
          totalUsed += deployVal;
        }
      });

      const otherSlots = [slots[0], slots[3]]; // Rotational buffer slots
      otherSlots.forEach((slot) => {
        if (totalUsed < poolLimit) {
          const deployVal = Math.min(Math.max(1, req - 1), poolLimit - totalUsed);
          nextAlloc[`${zone.zone}-${slot}`] = deployVal;
          totalUsed += deployVal;
        }
      });
    });

    setAllocations(nextAlloc);
    showToast('Deployment layout optimized successfully!');
  };

  // Reset grid allocation to blank
  const handleClearGrid = () => {
    setAllocations({});
    showToast('Deployment layout cleared.', 'info');
  };

  const handleToggleAutoDispatch = async () => {
    setAutoDispatchLoading(true);
    try {
      const res = await api.toggleAutoDispatch(!autoDispatch);
      if (res.data.success) {
        setAutoDispatch(res.data.auto_dispatch);
        showToast(
          `Auto-dispatch system is now ${res.data.auto_dispatch ? 'ENABLED' : 'DISABLED'}.`,
          res.data.auto_dispatch ? 'success' : 'info'
        );
      } else {
        showToast(res.data.error || 'Failed to toggle auto-dispatch', 'error');
      }
    } catch (err) {
      showToast('Network error toggling auto-dispatch', 'error');
    } finally {
      setAutoDispatchLoading(false);
    }
  };

  const handleManualDispatch = async (officerId, incident) => {
    try {
      const res = await api.dispatchOfficer({
        officer_id: officerId,
        target_lat: incident.latitude,
        target_lng: incident.longitude,
        zone: incident.zone,
        incident_id: incident.violation_id,
        vehicle_type: incident.vehicle_type
      });
      if (res.data.success) {
        showToast(`Successfully dispatched ${officerId} to resolve incident in ${incident.zone}.`, 'success');
      } else {
        showToast(res.data.error || 'Failed to dispatch officer', 'error');
      }
    } catch (err) {
      showToast('Network error during dispatch', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-command-accent border-t-transparent"></div>
          <span>Loading shift planning engine...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-command-danger/30 bg-command-danger/10 p-6 text-center text-command-danger">
        <p className="font-semibold">{error}</p>
        <button
          onClick={loadShiftData}
          className="mt-4 rounded-lg bg-command-danger px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Circular gauge config
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2; // = 46 (keeps circle centered and maximizes space inside)
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (complianceScore / 100) * circumference;

  let gaugeColor = 'text-command-danger';
  let gaugeBg = 'bg-command-danger/10 text-command-danger border-command-danger/20';
  let statusText = 'CRITICAL CORRIDOR RISK';
  
  if (complianceScore >= 75) {
    gaugeColor = 'text-command-success';
    gaugeBg = 'bg-command-success/15 text-command-success border-command-success/20';
    statusText = 'OPTIMAL CIVIC SECURITY';
  } else if (complianceScore >= 50) {
    gaugeColor = 'text-command-warning';
    gaugeBg = 'bg-command-warning/15 text-command-warning border-command-warning/20';
    statusText = 'CAUTION: UNDERSTAFFED';
  }

  return (
    <div className="space-y-6 pt-8">
      {/* Header and Live Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>Interactive Patrol Dispatch Canvas</h2>
          <p className="mt-1 text-xs text-gray-400 font-medium" style={{ fontFamily: "'Inter', sans-serif" }}>
            Consolidated tactical command center and strategic resource planning for Bengaluru corridors
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      {/* Toast Alert Banner */}
      {toast && (
        <div className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center justify-between transition-all duration-300 ${
          toast.type === 'error' 
            ? 'bg-command-danger/20 text-command-danger border-command-danger/30' 
            : toast.type === 'info'
            ? 'bg-command-accent/15 text-command-accent border-command-border'
            : 'bg-command-success/20 text-command-success border-command-success/30'
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="font-bold opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Active Officers Fleet (Live) */}
        <KPICard
          title="Live Officers Fleet"
          value={officers.length}
          subtitle={`${officers.filter(o => o.status === 'PATROLLING').length} Patrolling · ${officers.filter(o => o.status === 'DISPATCHED').length} En Route`}
          sparklineData={officers.map((_, i) => i + 1)}
          variant="accent"
        />
        {/* KPI 2: Live Incidents Queue (Live) */}
        <KPICard
          title="Live Incidents"
          value={(severity?.queue || []).length}
          subtitle={`Critical: ${(severity?.queue || []).filter(i => i.severity === 'CRITICAL').length}`}
          sparklineData={(severity?.queue || []).map(i => i.severity_score || 0)}
          variant="danger"
        />
        {/* KPI 3: Planned Coverage (Strategic) */}
        <KPICard
          title="Planned Coverage"
          value={`${complianceScore}%`}
          subtitle={`${totalDeployed} of ${poolLimit} officers allocated`}
          sparklineData={activeZones.map(z => slots.reduce((acc, slot) => acc + (allocations[`${z.zone}-${slot}`] || 0), 0))}
          variant="warning"
        />
        {/* KPI 4: Economic Delay Risk (Strategic) */}
        <KPICard
          title="Economic Delay Risk"
          value={formatINR(summary.total_economic_impact_inr)}
          subtitle="Projected gridlock cost"
          sparklineData={assignments.map((a) => a.economic_impact_inr || 0)}
          variant="default"
        />
      </div>

      {/* Interactive Shift Scheduler Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Left Side: Score Widget & Staff Deployed Pool (1 Col) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Live Compliance Score Gauge */}
          <div className="rounded-xl border border-command-border bg-command-panel p-6 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Compliance Forecast</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Live scheduler coverage projection</p>
            </div>
            
            {/* SVG Circular Ring Gauge */}
            <div className="relative mx-auto flex items-center justify-center" style={{ width: '128px', height: '128px' }}>
              <svg className="block" width="128" height="128" viewBox="0 0 128 128" style={{ width: '128px', height: '128px', minWidth: '128px', minHeight: '128px' }}>
                <g transform="rotate(-90 64 64)">
                  <circle
                    className="text-command-border stroke-current"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={normalizedRadius}
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className={`${gaugeColor} stroke-current transition-all duration-500`}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx="64"
                    cy="64"
                  />
                </g>
              </svg>
              <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-center" style={{ width: '128px', height: '128px' }}>
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">{complianceScore}%</span>
                <span className="block text-[8px] text-gray-500 uppercase tracking-wider font-bold">Coverage</span>
              </div>
            </div>

            <div className={`rounded-lg border px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider ${gaugeBg}`}>
              {statusText}
            </div>
          </div>

          {/* Resource Deployed Staffing Constraints */}
          <div className="rounded-xl border border-command-border bg-command-panel p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Active Staff Pool</h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Available officer resources on duty</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-900 dark:text-white">Deployed Officers:</span>
                <span className={totalDeployed === poolLimit ? "text-command-warning font-bold" : "text-[#BA5A5A]"}>
                  {totalDeployed} / {poolLimit} Deployed
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-command-bg border border-command-border overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    totalDeployed > poolLimit - 2 ? 'bg-command-warning' : 'bg-command-accent'
                  }`}
                  style={{ width: `${(totalDeployed / poolLimit) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Smart Actions Panel */}
            <div className="flex gap-2 pt-2 border-t border-command-border/40">
              <button
                onClick={handleSmartOptimize}
                className="flex-1 rounded-xl bg-command-accent text-white py-2 text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md shadow-command-accent/20 cursor-pointer text-center"
              >
                Auto Dispatch 🤖
              </button>
              <button
                onClick={handleClearGrid}
                className="flex-1 rounded-xl border border-command-border bg-command-bg py-2 text-xs font-bold text-gray-600 hover:bg-command-border/50 active:scale-95 transition-all cursor-pointer text-center"
              >
                Reset Grid
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Visual Shift Planner Grid (2 Cols) */}
        <div className="lg:col-span-2 rounded-xl border border-command-border bg-command-panel p-5 shadow-sm space-y-4">
          
          {/* Header Controls for Shift Grid */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-command-border/40 pb-4">
            
            {/* Shift Select */}
            <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-white/10 p-1 rounded-xl w-fit">
              {['Morning', 'Evening'].map((shift) => (
                <button
                  key={shift}
                  onClick={() => setSelectedShift(shift)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    selectedShift === shift
                      ? 'bg-[#BA5A5A] text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-white/5'
                  }`}
                >
                  {shift} Shift
                </button>
              ))}
            </div>

            {/* Priority filter option */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-800 dark:text-gray-200 outline-none cursor-pointer focus:border-[#BA5A5A]"
            >
              <option value="All">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          {/* Time-Grid Canvas Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-3 text-left text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-white/10">High-Risk Hub</th>
                  {slots.map((slot) => (
                    <th key={slot} className="p-3 text-center text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-white/10 min-w-[110px]">
                      ⏰ {slot}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-command-border/40">
                {activeZones.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-xs text-command-muted">
                      No shift records found for this filter combination.
                    </td>
                  </tr>
                ) : (
                  activeZones.map((z) => (
                    <tr key={z.zone} className="hover:bg-command-bg/30 transition-colors">
                      {/* Zone details & expected weight */}
                      <td className="p-3">
                        <div className="font-bold text-gray-900 dark:text-white text-sm">{z.zone}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold ${PRIORITY_BADGES[z.priority]}`}>
                            {z.priority}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium">{z.expected_violations} violations</span>
                        </div>
                      </td>

                      {/* Interactive Time slots */}
                      {slots.map((slot) => {
                        const key = `${z.zone}-${slot}`;
                        const count = allocations[key] || 0;
                        
                        // Select border colors based on deployment level
                        let cellStyle = 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 hover:bg-[#F9EDED] dark:hover:bg-white/5';
                        if (count > 0) {
                          if (count >= 3) {
                            cellStyle = 'border-command-danger/40 bg-command-danger/10 text-command-danger ring-2 ring-command-danger/15 font-extrabold';
                          } else {
                            cellStyle = 'border-[#BA5A5A]/40 bg-[#F9EDED] dark:bg-[#BA5A5A]/10 text-[#BA5A5A] font-extrabold';
                          }
                        }

                        return (
                          <td key={slot} className="p-2 text-center">
                            <button
                              onClick={() => handleCellClick(z.zone, slot)}
                              className={`w-full max-w-[130px] rounded-xl border p-2.5 text-center text-xs transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-0.5 ${cellStyle}`}
                            >
                              {count > 0 ? (
                                <>
                                  <span className="text-[15px]">{count >= 3 ? '🚨' : '👮'}</span>
                                  <span className="text-[9px] uppercase tracking-wider">{count} Staff</span>
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-400 dark:text-gray-600 font-bold">—</span>
                                  <span className="text-[8px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">Unpatrolled</span>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Unified Tactical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Live Force Control, Active Officers List, Emergency Queue (1 Column) */}
        <div className="lg:col-span-1 space-y-6 flex flex-col max-h-[700px]">
          
          {/* Live Force Telemetry & Control Panel */}
          <div className="rounded-xl border border-command-border bg-command-panel p-4 shadow-sm space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Live Force Telemetry & Control</h3>
              <p className="text-[10px] text-gray-400">Manage real-time dispatch and automation</p>
            </div>

            <div className="flex items-center justify-between border-t border-command-border/20 pt-2 text-xs font-semibold">
              <span className="text-gray-700 dark:text-gray-300 font-medium">AI Auto-Dispatcher</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleAutoDispatch}
                  disabled={autoDispatchLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${
                    autoDispatch ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-800'
                  } ${autoDispatchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoDispatch ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                  autoDispatch ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {autoDispatch ? 'ACTIVE' : 'MANUAL'}
                </span>
              </div>
            </div>
          </div>

          {/* Active Officer Fleet */}
          <div className="rounded-xl border border-command-border bg-command-panel p-4 shadow-sm flex flex-col h-[280px]">
            <div className="border-b border-command-border/40 pb-2 mb-2 flex-shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Active Officer Fleet</h3>
              <p className="text-[10px] text-gray-400">Click a card to focus on the map</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {officers.map((officer) => (
                <div 
                  key={officer.id} 
                  className={`p-2.5 rounded-xl border transition-all duration-300 bg-command-bg/40 cursor-pointer ${
                    selectedOfficer === officer.id 
                      ? 'border-[#BA5A5A] ring-2 ring-[#BA5A5A]/20 bg-command-bg/85' 
                      : 'border-command-border hover:border-gray-300 hover:bg-command-bg/60'
                  }`}
                  onClick={() => setSelectedOfficer(officer.id === selectedOfficer ? null : officer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">👮</span>
                      <div>
                        <h4 className="font-bold text-[11px] text-gray-900 dark:text-white leading-tight">{officer.name}</h4>
                        <span className="text-[8px] font-mono text-gray-400">{officer.id}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-0.5 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${
                      officer.status === 'IDLE' 
                        ? 'bg-gray-100 text-gray-600 border border-gray-200'
                        : officer.status === 'PATROLLING'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 animate-pulse'
                        : officer.status === 'DISPATCHED'
                        ? 'bg-amber-50 text-amber-600 border border-amber-200 font-semibold'
                        : 'bg-rose-50 text-rose-600 border border-rose-200 font-bold'
                    }`}>
                      {officer.status === 'PATROLLING' && <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />}
                      {officer.status}
                    </span>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px] border-t border-command-border/20 pt-1.5">
                    <div>
                      <span className="text-gray-400 font-medium block">Sector:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-bold">{officer.zone || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium block">Coordinates:</span>
                      <span className="text-gray-800 dark:text-gray-200 font-mono font-semibold">
                        {officer.lat.toFixed(4)}, {officer.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {officer.assigned_incident_id && (
                    <div className="mt-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-1.5 rounded-lg text-[9px] flex items-center justify-between text-rose-700 dark:text-rose-300">
                      <span>Incident: <strong>{officer.assigned_incident_id}</strong> ({officer.incident_type || 'CAR'})</span>
                      <span className="font-mono text-[8px] bg-rose-100 dark:bg-rose-900/50 px-1 rounded animate-pulse">ON SITE</span>
                    </div>
                  )}
                  
                  {officer.target_lat && officer.target_lng && officer.status === 'DISPATCHED' && (
                    <div className="mt-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-1.5 rounded-lg text-[9px] flex items-center justify-between text-amber-700 dark:text-amber-300">
                      <span>Heading to: <strong>{officer.zone}</strong></span>
                      <span className="font-mono text-[8px] bg-amber-100 dark:bg-amber-900/50 px-1 rounded animate-pulse">EN ROUTE</span>
                    </div>
                  )}
                </div>
              ))}
              {officers.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-8">Initializing officer telemetry stream...</div>
              )}
            </div>
          </div>

          {/* Emergency Dispatch Queue */}
          <div className="rounded-xl border border-command-border bg-command-panel p-4 shadow-sm flex flex-col h-[280px]">
            <div className="border-b border-command-border/40 pb-2 mb-2 flex-shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Emergency Dispatch Queue</h3>
              <p className="text-[10px] text-gray-400">Select an officer to manually assign to live incidents</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {(severity?.queue || []).map((incident) => {
                const isOnSite = officers.some(o => o.assigned_incident_id === incident.violation_id);
                const isHeading = officers.some(o => o.status === 'DISPATCHED' && o.assigned_incident_id === incident.violation_id);

                return (
                  <div 
                    key={incident.violation_id}
                    className="flex flex-col gap-1.5 p-2.5 rounded-lg border border-command-border bg-command-bg/40 hover:bg-command-bg/60 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          incident.severity === 'CRITICAL' 
                            ? 'bg-command-danger/25 text-command-danger'
                            : incident.severity === 'MEDIUM'
                            ? 'bg-command-warning/25 text-command-warning'
                            : 'bg-command-accent/25 text-command-accent'
                        }`}>
                          {incident.severity}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white">{incident.zone}</span>
                      </div>
                      
                      <span className="font-mono text-[8px] text-gray-400">{incident.violation_id}</span>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-gray-500">
                      <span>Vehicle: <strong>{incident.vehicle_type}</strong> · Score {incident.severity_score}</span>
                      <span>GPS: {incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}</span>
                    </div>

                    {/* Dispatch actions row */}
                    <div className="border-t border-command-border/10 pt-1.5 mt-1 flex justify-end">
                      {autoDispatch ? (
                        <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                          🤖 AI Managed
                        </span>
                      ) : isOnSite ? (
                        <span className="text-[8px] text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-0.5">
                          👮 Officer Arrived
                        </span>
                      ) : isHeading ? (
                        <span className="text-[8px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-0.5">
                          ⚡ Dispatch Active
                        </span>
                      ) : (
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const offId = e.target.value;
                            if (offId) {
                              handleManualDispatch(offId, incident);
                              e.target.value = ""; // reset
                            }
                          }}
                          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded px-2 py-1 text-[9px] text-gray-800 dark:text-gray-200 outline-none cursor-pointer focus:border-[#BA5A5A]"
                        >
                          <option value="" disabled>Dispatch Fleet Officer...</option>
                          {officers
                            .filter(o => o.status === 'IDLE' || o.status === 'PATROLLING')
                            .map(o => (
                              <option key={o.id} value={o.id}>
                                {o.name} ({o.status})
                              </option>
                            ))
                          }
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
              {(!severity?.queue || severity.queue.length === 0) && (
                <div className="text-center text-xs text-gray-400 py-8">No active incidents in the emergency queue.</div>
              )}
            </div>
          </div>

        </div>

        {/* Right Side: Large Map Viewport (2 Columns) */}
        <div className="lg:col-span-2 rounded-xl border border-command-border bg-command-panel p-4 shadow-sm flex flex-col h-[600px] lg:h-[660px]">
          <div className="border-b border-command-border/40 pb-2 mb-2 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Tactical Area Live Grid</h3>
              <p className="text-[10px] text-gray-400">Interactive live telemetry tracking of officer beats and incident hotspots</p>
            </div>
            <div className="flex gap-2 text-[8px] font-extrabold uppercase">
              <span className="flex items-center gap-0.5 text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded">● Patrolling</span>
              <span className="flex items-center gap-0.5 text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded">● En Route</span>
              <span className="flex items-center gap-0.5 text-rose-500 bg-rose-500/10 border border-rose-500/20 px-1 py-0.5 rounded">● On-Scene</span>
            </div>
          </div>

          {/* Map viewport container */}
          <div className="flex-1 rounded-lg overflow-hidden relative" style={{ minHeight: '350px' }}>
            <MapContainer center={BENGALURU_CENTER} zoom={12} scrollWheelZoom={true} style={{ height: '100%' }}>
              <LayersControl position="topright">
                {MAPMYINDIA_KEY && (
                  <LayersControl.BaseLayer checked={false} name="MapmyIndia (Mappls)">
                    <TileLayer
                      attribution='&copy; <a href="https://www.mappls.com/">Mappls MapmyIndia</a>'
                      url={`https://apis.mapmyindia.com/advancedmaps/v1/${MAPMYINDIA_KEY}/map_style/{z}/{x}/{y}.png`}
                    />
                  </LayersControl.BaseLayer>
                )}
                <LayersControl.BaseLayer checked={true} name="Google Streets">
                  <TileLayer
                    attribution="&copy; Google Maps"
                    url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer name="Dark Mode">
                  <TileLayer
                    attribution="&copy; CartoDB"
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                </LayersControl.BaseLayer>

                {/* Recidivism layer overlay */}
                <LayersControl.Overlay checked name="Recidivism Hotspots">
                  <LayerGroup>
                    {(recidivism?.zones || []).map((zone) => (
                      <CircleMarker
                        key={`recidivism-${zone.zone}`}
                        center={[zone.latitude, zone.longitude]}
                        radius={12 + zone.recurrence_rate * 30}
                        pathOptions={{
                          color: zone.is_stubborn_zone ? '#A33B3B' : '#C0613F',
                          fillColor: zone.is_stubborn_zone ? '#A33B3B' : '#C0613F',
                          fillOpacity: 0.25,
                          weight: 2,
                          dashArray: '5, 5',
                        }}
                      >
                        <Popup>
                          <div className="text-xs p-1">
                            <div className="font-bold text-gray-900">{zone.zone}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">Recidivism Rate: {(zone.recurrence_rate * 100).toFixed(1)}%</div>
                            <div className="mt-1 border-t pt-1 border-gray-100">
                              {zone.is_stubborn_zone ? (
                                <span className="text-rose-600 font-bold">⚠️ STUBBORN ZONE</span>
                              ) : (
                                <span className="text-amber-600 font-semibold">Monitor Corridor</span>
                              )}
                              <p className="mt-1 text-gray-600 font-medium">{zone.recommendation}</p>
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </LayerGroup>
                </LayersControl.Overlay>
              </LayersControl>

              {/* Map Controller for selection centering */}
              <MapController selectedOfficer={selectedOfficer} officers={officers} />

              {/* Draw Polyline path for dispatched officers */}
              {officers.map(officer => {
                if (officer.status === 'DISPATCHED' && officer.lat && officer.lng && officer.target_lat && officer.target_lng) {
                  return (
                    <Polyline
                      key={`path-${officer.id}`}
                      positions={[
                        [officer.lat, officer.lng],
                        [officer.target_lat, officer.target_lng]
                      ]}
                      pathOptions={{
                        color: '#F59E0B',
                        dashArray: '5, 10',
                        weight: 2
                      }}
                    />
                  );
                }
                return null;
              })}

              {/* Draw Officers as CircleMarkers */}
              {officers.map((officer) => {
                if (!officer.lat || !officer.lng) return null;
                const isSelected = selectedOfficer === officer.id;
                let color = '#64748B'; // slate (IDLE)
                if (officer.status === 'PATROLLING') color = '#10B981'; // emerald
                if (officer.status === 'DISPATCHED') color = '#F59E0B'; // amber
                if (officer.status === 'ON_SCENE') color = '#EF4444'; // rose

                return (
                  <CircleMarker
                    key={`officer-${officer.id}`}
                    center={[officer.lat, officer.lng]}
                    radius={isSelected ? 13 : 9}
                    pathOptions={{
                      color: isSelected ? '#BA5A5A' : '#ffffff',
                      fillColor: color,
                      fillOpacity: 0.85,
                      weight: isSelected ? 4 : 2,
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1">
                        <div className="font-bold text-gray-900">{officer.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{officer.id} · {officer.status}</div>
                        <div className="mt-1.5 border-t pt-1 border-gray-100">
                          <div><strong>Location:</strong> {officer.zone || 'N/A'}</div>
                          <div><strong>Coordinates:</strong> {officer.lat.toFixed(4)}, {officer.lng.toFixed(4)}</div>
                          {officer.assigned_incident_id && (
                            <div className="mt-1 text-rose-600 font-medium">Resolving violation {officer.assigned_incident_id}</div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}

              {/* Draw Incidents as Warning Circles */}
              {(severity?.queue || []).map((incident) => {
                if (!incident.latitude || !incident.longitude) return null;

                let color = '#3B82F6'; // blue (LOW)
                if (incident.severity === 'CRITICAL') color = '#EF4444'; // red
                if (incident.severity === 'MEDIUM') color = '#F59E0B'; // amber

                return (
                  <CircleMarker
                    key={`incident-${incident.violation_id}`}
                    center={[incident.latitude, incident.longitude]}
                    radius={8}
                    pathOptions={{
                      color: '#ffffff',
                      fillColor: color,
                      fillOpacity: 0.75,
                      weight: 1,
                    }}
                  >
                    <Popup>
                      <div className="text-xs p-1">
                        <div className="font-bold text-gray-900">{incident.zone} ({incident.vehicle_type})</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">Violation ID: {incident.violation_id}</div>
                        <div className="mt-1 border-t pt-1 border-gray-100">
                          <div><strong>Severity:</strong> <span className="font-bold">{incident.severity}</span> (Score: {incident.severity_score})</div>
                          <div><strong>Coordinates:</strong> {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</div>
                          
                          {/* Quick Dispatch Action from map popover if manual */}
                          {!autoDispatch && (
                            <div className="mt-2 pt-1 border-t border-dashed flex flex-col gap-1">
                              <span className="text-[9px] text-gray-400 uppercase font-bold">Quick Dispatch:</span>
                              <div className="flex flex-wrap gap-1">
                                {officers
                                  .filter(o => o.status === 'IDLE' || o.status === 'PATROLLING')
                                  .map(o => (
                                    <button
                                      key={o.id}
                                      onClick={() => handleManualDispatch(o.id, incident)}
                                      className="bg-[#BA5A5A] text-white text-[9px] font-bold px-1.5 py-0.5 rounded hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                                    >
                                      {o.id.replace('OFF-', 'OFF ')}
                                    </button>
                                  ))
                                }
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Scrolling System Command Terminal */}
      <div className="rounded-xl border border-[#334155] bg-[#0F172A] p-4 shadow-inner flex flex-col h-40">
        <div className="flex items-center justify-between border-b border-[#334155] pb-2 mb-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="font-mono text-xs text-gray-400 font-bold uppercase tracking-wider">Telemetry Dispatch Feed</span>
          </div>
          <span className="font-mono text-[9px] text-gray-500 font-bold">READY</span>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-[10px] text-[#38BDF8] space-y-1 pr-2 no-scrollbar">
          {dispatchLogs.map((log, idx) => {
            let textClass = 'text-[#38BDF8]';
            if (log.message.includes('AUTO-DISPATCH')) {
              textClass = 'text-emerald-400 font-bold';
            } else if (log.message.includes('DISPATCH:')) {
              textClass = 'text-amber-400 font-bold';
            } else if (log.message.includes('arrived at scene') || log.message.includes('cleared')) {
              textClass = 'text-white/95 font-semibold';
            } else if (log.message.includes('SYSTEM:')) {
              textClass = 'text-purple-400';
            }

            return (
              <div key={idx} className={textClass}>
                {log.message}
              </div>
            );
          })}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Operational Briefs & Protocols Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EnforcementBrief shiftData={data} predictions={predictions} corridors={corridors} />
        
        {/* Force Deployment Standard Protocols */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-command-panel p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Force Deployment Standard Protocols</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 p-3 border border-gray-200 dark:border-white/5">
                <span className="rounded bg-command-danger/25 px-1.5 py-0.5 text-command-danger font-extrabold text-[8px] border border-command-danger/30 whitespace-nowrap mt-0.5">3-4 STAFF</span>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs">Critical Escort & Towing Unit</h4>
                  <p className="text-gray-500 text-[11px] mt-0.5">Assigned to high-density bottlenecks. Continuous rotations to clear lanes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 p-3 border border-gray-200 dark:border-white/5">
                <span className="rounded bg-command-warning/25 px-1.5 py-0.5 text-command-warning font-extrabold text-[8px] border border-command-warning/30 whitespace-nowrap mt-0.5">2 STAFF</span>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs">Wheel-Clamping Patrol</h4>
                  <p className="text-gray-500 text-[11px] mt-0.5">Rotational clamps deployed for sidewalk obstruction with camera evidence.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 p-3 border border-gray-200 dark:border-white/5">
                <span className="rounded bg-[#F9EDED] dark:bg-[#BA5A5A]/10 px-1.5 py-0.5 text-[#BA5A5A] font-extrabold text-[8px] border border-[#BA5A5A]/30 whitespace-nowrap mt-0.5">1 STAFF</span>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs">Junction Inspection Loop</h4>
                  <p className="text-gray-500 text-[11px] mt-0.5">Routine drive-by checks every 2 hours to clear lane splitting.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
