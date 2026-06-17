import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useLiveFeed } from '../hooks/useLiveFeed';
import KPICard from '../components/KPICard';
import LiveStatusBar from '../components/LiveStatusBar';

function formatINR(amount) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount?.toLocaleString('en-IN') || 0}`;
}

const PRIORITY_BADGES = {
  CRITICAL: 'bg-command-danger/20 text-command-danger border border-command-danger/30',
  HIGH: 'bg-command-warning/20 text-command-warning border border-command-warning/30',
  MEDIUM: 'bg-command-accent/20 text-command-accent border border-command-accent/30',
  LOW: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
};

const SHIFT_BADGES = {
  Morning: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  Evening: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
};

export default function ShiftPlannerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastTick, setLastTick] = useState(null);

  // Filter states
  const [selectedShift, setSelectedShift] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [sortBy, setSortBy] = useState('priority'); // 'priority' | 'economic' | 'violations'

  // Fetch shift planner data
  const loadShiftData = useCallback(async () => {
    try {
      const response = await api.getShiftPlanner();
      setData(response.data);
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
      loadShiftData();
    }
  }, [loadShiftData]);

  const { connected, status } = useLiveFeed(handleLiveTick);

  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-command-accent border-t-transparent"></div>
          <span>Loading deployment plans...</span>
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

  const assignments = data?.assignments || [];
  const summary = data?.summary || {};

  // Filter logic
  const filteredAssignments = assignments
    .filter((a) => {
      const shiftMatch = selectedShift === 'All' || a.shift === selectedShift;
      const priorityMatch = selectedPriority === 'All' || a.priority === selectedPriority;
      return shiftMatch && priorityMatch;
    })
    .sort((a, b) => {
      if (sortBy === 'economic') {
        return b.economic_impact_inr - a.economic_impact_inr;
      }
      if (sortBy === 'violations') {
        return b.expected_violations - a.expected_violations;
      }
      // Default: priority order
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  // Calculate stats for current view
  const morningCount = assignments.filter((a) => a.shift === 'Morning').length;
  const eveningCount = assignments.filter((a) => a.shift === 'Evening').length;

  return (
    <div className="space-y-6">
      {/* Header and Live Status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Smart Officer Shift Planner</h2>
          <p className="mt-1 text-sm text-command-muted">
            Risk-adjusted tactical deployment schedule based on violation forecasting and economic losses
          </p>
        </div>
        <LiveStatusBar connected={connected} status={status} lastTick={lastTick} />
      </div>

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Recommended Officers"
          value={summary.total_officers_recommended || 0}
          subtitle="Tactical staff allocation"
          variant="accent"
        />
        <KPICard
          title="Economic Risk Impact"
          value={formatINR(summary.total_economic_impact_inr)}
          subtitle="Projected delay losses (INR)"
          variant="danger"
        />
        <KPICard
          title="Critical Zones"
          value={summary.critical_zones || 0}
          subtitle={`High priority: ${summary.high_priority_zones || 0}`}
          variant="warning"
        />
        <KPICard
          title="Expected Violations"
          value={summary.total_expected_violations || 0}
          subtitle="Next 24-hour prediction"
          variant="default"
        />
      </div>

      {/* Controls: Filters and Sorting */}
      <div className="flex flex-col gap-4 rounded-xl border border-command-border bg-command-panel p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          {/* Shift Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Shift</label>
            <div className="inline-flex rounded-lg bg-command-bg p-0.5 border border-command-border">
              {['All', 'Morning', 'Evening'].map((shift) => (
                <button
                  key={shift}
                  onClick={() => setSelectedShift(shift)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedShift === shift
                      ? 'bg-command-accent text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {shift}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Priority</label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="rounded-lg border border-command-border bg-command-bg px-3 py-1.5 text-xs text-white outline-none focus:border-command-accent"
            >
              <option value="All">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>
        </div>

        {/* Sorting Selection */}
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1 md:text-right">Sort By</label>
          <div className="inline-flex rounded-lg bg-command-bg p-0.5 border border-command-border">
            {[
              { id: 'priority', label: 'Priority Rank' },
              { id: 'economic', label: 'Economic Loss' },
              { id: 'violations', label: 'Violations' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortBy === opt.id
                    ? 'bg-command-accent text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: Card List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredAssignments.length === 0 ? (
          <div className="col-span-full rounded-xl border border-command-border bg-command-panel p-12 text-center text-command-muted">
            No shifts match your selected filters.
          </div>
        ) : (
          filteredAssignments.map((assignment) => (
            <div
              key={assignment.zone}
              className="relative overflow-hidden rounded-xl border border-command-border bg-command-panel p-5 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-lg font-bold text-white">{assignment.zone}</h4>
                  <span className="text-xs text-command-muted">Bengaluru Zone</span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${PRIORITY_BADGES[assignment.priority]}`}>
                    {assignment.priority}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${SHIFT_BADGES[assignment.shift]}`}>
                    {assignment.shift} Shift
                  </span>
                </div>
              </div>

              {/* Officer Recommendation Section */}
              <div className="mt-5 rounded-lg bg-command-bg p-3 border border-command-border">
                <div className="flex items-center justify-between text-xs text-command-muted mb-2">
                  <span>DEPLOYMENT FORCE</span>
                  <span className="font-bold text-white">{assignment.officers_recommended} Officers</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: assignment.officers_recommended }).map((_, i) => (
                    <span
                      key={i}
                      className="flex h-7 w-7 items-center justify-center rounded bg-command-accent/10 border border-command-accent/20 text-sm font-semibold text-command-accent animate-pulse"
                      title="Recommended officer seat"
                    >
                      👮
                    </span>
                  ))}
                  {assignment.officers_recommended === 0 && (
                    <span className="text-xs text-gray-500 font-medium py-1">No patrols recommended</span>
                  )}
                </div>
              </div>

              {/* Economic & Infraction Details */}
              <div className="mt-4 space-y-3">
                {/* Expected Violations Bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Expected Violations</span>
                    <span className="font-medium text-white">{assignment.expected_violations} / day</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-command-bg overflow-hidden border border-command-border">
                    <div
                      className={`h-full rounded-full ${
                        assignment.priority === 'CRITICAL'
                          ? 'bg-command-danger'
                          : assignment.priority === 'HIGH'
                          ? 'bg-command-warning'
                          : 'bg-command-accent'
                      }`}
                      style={{ width: `${Math.min((assignment.expected_violations / 25) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Economic Loss Card footer */}
                <div className="flex items-center justify-between pt-2 border-t border-command-border text-xs">
                  <span className="text-command-muted">Economic Delay Loss:</span>
                  <span className="text-sm font-bold text-white">{formatINR(assignment.economic_impact_inr)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deployment Protocol Guidelines */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Schedule Overview */}
        <div className="rounded-xl border border-command-border bg-command-panel p-6 lg:col-span-1">
          <h3 className="text-lg font-semibold text-white mb-3">Staffing Schedule</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-command-bg p-3 border border-command-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌅</span>
                <div>
                  <h5 className="text-xs font-semibold text-gray-300">Morning Shift</h5>
                  <p className="text-[10px] text-command-muted">06:00 AM - 02:00 PM</p>
                </div>
              </div>
              <span className="rounded bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400 font-bold border border-blue-500/20">
                {morningCount} Zones
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-command-bg p-3 border border-command-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🌃</span>
                <div>
                  <h5 className="text-xs font-semibold text-gray-300">Evening Shift</h5>
                  <p className="text-[10px] text-command-muted">02:00 PM - 10:00 PM</p>
                </div>
              </div>
              <span className="rounded bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400 font-bold border border-purple-500/20">
                {eveningCount} Zones
              </span>
            </div>
          </div>
        </div>

        {/* Deployment Protocol Brief */}
        <div className="rounded-xl border border-command-border bg-command-panel p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-3">Enforcement Protocol Recommendations</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-command-bg p-3 border border-command-border">
              <span className="rounded bg-command-danger/20 px-2.5 py-0.5 text-command-danger font-bold text-[10px] border border-command-danger/30">
                CRITICAL PROTOCOL
              </span>
              <p className="mt-2 text-gray-300 font-medium">Active Towing & Tow-Truck Escort</p>
              <p className="mt-1 text-command-muted">Deploy 4 officers. Immediately relocate vehicles double parking or blocking intersections. Issue spot-fines.</p>
            </div>

            <div className="rounded-lg bg-command-bg p-3 border border-command-border">
              <span className="rounded bg-command-warning/20 px-2.5 py-0.5 text-command-warning font-bold text-[10px] border border-command-warning/30">
                HIGH PROTOCOL
              </span>
              <p className="mt-2 text-gray-300 font-medium">Constant Patrol & Wheel-clamping</p>
              <p className="mt-1 text-command-muted">Deploy 3 officers. Wheel-clamp offending vehicles. Refresh roadside warning signage to deter wrong parking.</p>
            </div>

            <div className="rounded-lg bg-command-bg p-3 border border-command-border">
              <span className="rounded bg-command-accent/20 px-2.5 py-0.5 text-command-accent font-bold text-[10px] border border-command-accent/30">
                MEDIUM PROTOCOL
              </span>
              <p className="mt-2 text-gray-300 font-medium">Routine Patrol Checks</p>
              <p className="mt-1 text-command-muted">Deploy 2 officers. Run standard rotational patrol cycles. Monitor lane obstructions during peak hours.</p>
            </div>

            <div className="rounded-lg bg-command-bg p-3 border border-command-border">
              <span className="rounded bg-gray-500/10 px-2.5 py-0.5 text-gray-400 font-bold text-[10px] border border-gray-500/20">
                LOW PROTOCOL
              </span>
              <p className="mt-2 text-gray-300 font-medium">Standard Monitoring Rotation</p>
              <p className="mt-1 text-command-muted">Deploy 1 officer. Check hotspots every 4 hours. Standard fine collection for footpath or wrong-side violations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
