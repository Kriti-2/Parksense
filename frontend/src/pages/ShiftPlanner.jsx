import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import KPICard from '../components/KPICard';
import LiveStatusBar from '../components/LiveStatusBar';
import EnforcementBrief from '../components/EnforcementBrief';
import SeverityQueue from '../components/SeverityQueue';
import RecidivismMap from '../components/RecidivismMap';

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

  const poolLimit = 16; // 16 max officers available for scheduling
  const slots = useMemo(() => {
    return selectedShift === 'Morning'
      ? ["06:00 - 08:00", "08:00 - 10:00", "10:00 - 12:00", "12:00 - 14:00"]
      : ["14:00 - 16:00", "16:00 - 18:00", "18:00 - 20:00", "20:00 - 22:00"];
  }, [selectedShift]);

  // Fetch shift planner data and other consolidated operational stats
  const loadShiftData = useCallback(async () => {
    try {
      const [shRes, prRes, coRes, seRes, reRes] = await Promise.all([
        api.getShiftPlanner(),
        api.getPredictions(),
        api.getCorridors(),
        api.getSeverityQueue(20),
        api.getRecidivism()
      ]);

      const resData = shRes.data;
      setData(resData);
      setPredictions(prRes.data);
      setCorridors(coRes.data);
      setSeverity(seRes.data);
      setRecidivism(reRes.data);
      
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
  const normalizedRadius = radius - strokeWidth * 2;
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
            Drag, toggle, or auto-optimize officer patrols to protect active emergency corridors
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Optimal Dispatch"
          value={summary.total_officers_recommended || 0}
          subtitle="Total recommended staff"
          sparklineData={assignments.map((a) => a.officers_recommended || 0)}
          variant="accent"
        />
        <KPICard
          title="Economic Delay Risk"
          value={formatINR(summary.total_economic_impact_inr)}
          subtitle="Projected gridlock cost"
          sparklineData={assignments.map((a) => a.economic_impact_inr || 0)}
          variant="danger"
        />
        <KPICard
          title="Critical Intersections"
          value={summary.critical_zones || 0}
          subtitle={`High priority: ${summary.high_priority_zones || 0}`}
          sparklineData={assignments.map((a) => (a.priority === 'CRITICAL' ? 3 : a.priority === 'HIGH' ? 2 : 1))}
          variant="warning"
        />
        <KPICard
          title="Projected Violations"
          value={summary.total_expected_violations || 0}
          subtitle="Estimated offenses (24h)"
          sparklineData={assignments.map((a) => a.expected_violations || 0)}
          variant="default"
        />
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

      {/* Main Allocation Area — right after KPI cards */}
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
            <div className="relative flex items-center justify-center">
              <svg className="h-32 w-32 transform -rotate-90" viewBox="0 0 128 128">
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
              </svg>
              <div className="absolute text-center">
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

      {/* Operational Briefs Section — below dispatch canvas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EnforcementBrief shiftData={data} predictions={predictions} corridors={corridors} />
        <SeverityQueue data={severity} />
      </div>

      <RecidivismMap data={recidivism} />

      {/* Deployment Protocol Brief */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-command-panel p-6">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-white/10 pb-2">Force Deployment Standard Protocols</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-white/10">
            <span className="rounded bg-command-danger/25 px-2 py-0.5 text-command-danger font-bold text-[9px] border border-command-danger/30">
              🚨 3-4 OFFICERS (CRITICAL)
            </span>
            <p className="mt-2 text-gray-900 dark:text-white font-bold text-sm">Escort & Towing Unit</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">Assigned to high-density bottlenecks. Officers run continuous rotations, relcoating double-parked vehicles to cleared lots.</p>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-white/10">
            <span className="rounded bg-command-warning/25 px-2 py-0.5 text-command-warning font-bold text-[9px] border border-command-warning/30">
              👮 2 OFFICERS (HIGH)
            </span>
            <p className="mt-2 text-gray-900 dark:text-white font-bold text-sm">Wheel-Clamping Patrol</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">Rotational clamps deployed for sidewalk obstruction. Spot-challans issued automatically with camera evidence feeds.</p>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-white/10">
            <span className="rounded bg-[#F9EDED] dark:bg-[#BA5A5A]/10 px-2 py-0.5 text-[#BA5A5A] font-bold text-[9px] border border-[#BA5A5A]/30">
              👮 1 OFFICER (MEDIUM)
            </span>
            <p className="mt-2 text-gray-900 dark:text-white font-bold text-sm">Inspection Loop</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">Routine patrol drive-by every 2 hours to clear lane-splitting or wrong-side parking and keep junctions fluid.</p>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4 border border-gray-200 dark:border-white/10">
            <span className="rounded bg-gray-500/10 px-2 py-0.5 text-gray-500 font-bold text-[9px] border border-gray-500/20">
              — 0 OFFICERS (LOW)
            </span>
            <p className="mt-2 text-gray-900 dark:text-white font-bold text-sm">CCTV Telemetry Only</p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">No physical officer footprint on location. The corridor is monitored using computer vision edge nodes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
