import React, { useState, useMemo } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  DeviceWorkload,
  WorkloadProfile,
  WorkloadScope,
  WorkloadProfileCategory,
} from '../../types/ispWorkload';
import { DEFAULT_WORKLOAD_PROFILES } from '../../data/defaultWorkloadProfiles';
import { WORKLOAD_SCENARIO_PRESETS } from '../../data/workloadScenarios';
import { WorkloadAssignmentModal } from './WorkloadAssignmentModal';
import { WorkloadProfileModal } from './WorkloadProfileModal';
import {
  Activity,
  Plus,
  Search,
  Filter,
  Users,
  Sliders,
  ArrowDown,
  ArrowUp,
  Layers,
  Sparkles,
  Copy,
  Edit2,
  Trash2,
  Power,
  CheckCircle2,
  XCircle,
  Building2,
  GraduationCap,
  Home,
  Briefcase,
  Server,
  Video,
  Settings,
  ChevronRight,
  Shield,
  HelpCircle,
} from 'lucide-react';

const EMPTY_WORKLOADS: DeviceWorkload[] = [];
const EMPTY_PROFILES: WorkloadProfile[] = [];

export const WorkloadManagementDashboard: React.FC = () => {
  const {
    activeProject,
    addWorkload,
    updateWorkload,
    deleteWorkload,
    duplicateWorkload,
    toggleWorkloadEnabled,
    addWorkloadProfile,
    updateWorkloadProfile,
    deleteWorkloadProfile,
    workloadSummary,
    circuitTelemetry,
    deviceProcessingMetrics,
    isTrafficRunning,
    toggleTrafficSimulation,
    loadScenarioPreset,
  } = useNetworkStore();

  const workloads = activeProject.workloads || EMPTY_WORKLOADS;
  const customProfiles = activeProject.workloadProfiles || EMPTY_PROFILES;
  const devices = activeProject.devices || [];
  const vlans = activeProject.vlans || [];

  // Combine default and custom profiles for reference
  const allProfiles = useMemo(() => {
    const map = new Map<string, WorkloadProfile>();
    DEFAULT_WORKLOAD_PROFILES.forEach((p) => map.set(p.id, p));
    customProfiles.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [customProfiles]);

  const [activeTab, setActiveTab] = useState<'assignments' | 'profiles'>('assignments');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | WorkloadScope>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | WorkloadProfileCategory>('all');

  // Modals
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [editingWorkload, setEditingWorkload] = useState<DeviceWorkload | null>(null);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<WorkloadProfile | null>(null);

  // Filtered Workload Assignments
  const filteredWorkloads = useMemo(() => {
    return workloads.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.profileCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.targetSubnet && w.targetSubnet.includes(searchQuery));
      const matchesScope = scopeFilter === 'all' || w.scope === scopeFilter;
      const matchesCategory = categoryFilter === 'all' || w.profileCategory === categoryFilter;
      return matchesSearch && matchesScope && matchesCategory;
    });
  }, [workloads, searchQuery, scopeFilter, categoryFilter]);

  // Aggregate KPI Metrics
  const aggregateKpis = useMemo(() => {
    let totalAssigned = workloads.length;
    let totalActive = 0;
    let totalUsers = 0;
    let totalEffectiveUsers = 0;
    let totalAvgDownMbps = 0;
    let totalAvgUpMbps = 0;
    let totalPeakDownMbps = 0;
    let totalPeakUpMbps = 0;

    for (const w of workloads) {
      if (w.enabled) {
        totalActive++;
        totalUsers += w.activeUsers || 0;
        const eff = (w.activeUsers || 0) * (w.concurrencyFactor || 0.4);
        totalEffectiveUsers += eff;
        totalAvgDownMbps += (w.averageDownloadKbps || 0) / 1000;
        totalAvgUpMbps += (w.averageUploadKbps || 0) / 1000;
        totalPeakDownMbps += (w.peakDownloadKbps || 0) / 1000;
        totalPeakUpMbps += (w.peakUploadKbps || 0) / 1000;
      }
    }

    return {
      totalAssigned,
      totalActive,
      totalUsers,
      totalEffectiveUsers: Math.round(totalEffectiveUsers),
      totalAvgDownMbps: Math.round(totalAvgDownMbps * 10) / 10,
      totalAvgUpMbps: Math.round(totalAvgUpMbps * 10) / 10,
      totalPeakDownMbps: Math.round(totalPeakDownMbps * 10) / 10,
      totalPeakUpMbps: Math.round(totalPeakUpMbps * 10) / 10,
    };
  }, [workloads]);

  const getCategoryIcon = (cat: WorkloadProfileCategory) => {
    switch (cat) {
      case 'campus':
        return <GraduationCap className="w-4 h-4 text-emerald-400" />;
      case 'office':
        return <Building2 className="w-4 h-4 text-cyan-400" />;
      case 'residential':
        return <Home className="w-4 h-4 text-indigo-400" />;
      case 'small-business':
        return <Briefcase className="w-4 h-4 text-amber-400" />;
      case 'server':
        return <Server className="w-4 h-4 text-purple-400" />;
      case 'cctv':
        return <Video className="w-4 h-4 text-rose-400" />;
      default:
        return <Settings className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'normal':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'low':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    }
  };

  const getTargetDescription = (w: DeviceWorkload) => {
    if (w.scope === 'vlan') {
      const vlan = vlans.find((v) => v.id === w.targetVlanId);
      return vlan ? `VLAN ${vlan.id}: ${vlan.name} (${vlan.subnet || 'No Subnet'})` : `VLAN ${w.targetVlanId}`;
    }
    if (w.scope === 'device') {
      const dev = devices.find((d) => d.id === w.targetDeviceId);
      return dev ? `Device: ${dev.name} [${dev.category}]` : 'Single Device';
    }
    if (w.scope === 'group') {
      const count = w.targetDeviceIds?.length || 0;
      return `Device Group (${count} Nodes)`;
    }
    if (w.scope === 'subnet') {
      return `Subnet: ${w.targetSubnet || 'N/A'}`;
    }
    return 'Site-wide';
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Banner / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100">Realistic Workload & Traffic Generator</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                Phase 4–6 Live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Model simultaneous endpoint traffic demands across VLANs, devices, and internet uplinks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub-tab navigation */}
          <div className="flex bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/80 mr-2">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'assignments'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Assignments ({workloads.length})
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'profiles'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Profile Library ({allProfiles.length})
            </button>
          </div>

          <div className="relative">
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  loadScenarioPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              className="px-3 py-2 bg-slate-800/90 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-cyan-500 cursor-pointer shadow-sm"
            >
              <option value="" disabled>Load Scenario Preset...</option>
              {WORKLOAD_SCENARIO_PRESETS.map((scn) => (
                <option key={scn.id} value={scn.id}>
                  {scn.name} [{scn.badge}]
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setEditingWorkload(null);
              setIsAssignmentModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Assign Workload
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 bg-slate-900/40 border-b border-slate-800/80 shrink-0">
        <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Active Workloads</div>
            <div className="text-lg font-bold font-mono text-slate-100">
              {aggregateKpis.totalActive}{' '}
              <span className="text-xs font-normal text-slate-500">/ {aggregateKpis.totalAssigned} assigned</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Simulated Active Users</div>
            <div className="text-lg font-bold font-mono text-slate-100">
              {aggregateKpis.totalEffectiveUsers}{' '}
              <span className="text-xs font-normal text-slate-500">({aggregateKpis.totalUsers} configured)</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <ArrowDown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Aggregate Downlink Demand</div>
            <div className="text-lg font-bold font-mono text-cyan-300">
              {aggregateKpis.totalAvgDownMbps}{' '}
              <span className="text-xs font-normal text-slate-400">Mbps</span>{' '}
              <span className="text-xs font-normal text-amber-400/90 font-mono">
                (Peak {aggregateKpis.totalPeakDownMbps} M)
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ArrowUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Aggregate Uplink Demand</div>
            <div className="text-lg font-bold font-mono text-purple-300">
              {aggregateKpis.totalAvgUpMbps}{' '}
              <span className="text-xs font-normal text-slate-400">Mbps</span>{' '}
              <span className="text-xs font-normal text-purple-400/80 font-mono">
                (Peak {aggregateKpis.totalPeakUpMbps} M)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Engine Real-Time Delivery & Capacity Status Bar */}
      {workloadSummary && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 bg-slate-900/90 border-b border-slate-800 text-xs font-mono shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isTrafficRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="font-sans font-semibold text-slate-300">
                Engine: {isTrafficRunning ? 'Generating Real-Time Traffic' : 'Simulation Paused'}
              </span>
            </div>

            <div className="text-slate-400">
              Throughput Delivered:{' '}
              <strong className="text-emerald-400">
                ↓ {workloadSummary.totalDeliveredDownMbps} Mbps / ↑ {workloadSummary.totalDeliveredUpMbps} Mbps
              </strong>
            </div>

            {workloadSummary.totalDroppedDownMbps > 0 && (
              <div className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                DROPPED: ↓ {workloadSummary.totalDroppedDownMbps} Mbps (WAN Saturated)
              </div>
            )}

            {workloadSummary.mostUtilizedDevice && workloadSummary.mostUtilizedDevice.cpuLoad > 85 && (
              <div className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ROUTER CPU BOTTLENECK: {workloadSummary.mostUtilizedDevice.name} ({workloadSummary.mostUtilizedDevice.cpuLoad}%)
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTrafficSimulation}
              className={`px-2.5 py-1 rounded text-[11px] font-sans font-semibold transition-colors ${
                isTrafficRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
            >
              {isTrafficRunning ? 'Pause Engine' : 'Resume Engine'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {activeTab === 'assignments' ? (
          <>
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search workloads by name, category, or subnet..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Scopes</option>
                  <option value="vlan">VLANs</option>
                  <option value="device">Single Device</option>
                  <option value="group">Device Group</option>
                  <option value="subnet">Subnet</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Categories</option>
                  <option value="campus">Campus</option>
                  <option value="office">Office</option>
                  <option value="residential">Residential</option>
                  <option value="small-business">Small Business</option>
                  <option value="server">Server</option>
                  <option value="cctv">CCTV</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Workloads List */}
            {filteredWorkloads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-400 mb-3">
                  <Activity className="w-8 h-8 text-cyan-400/60" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">No Workload Assignments Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  {workloads.length === 0
                    ? 'Create your first realistic workload profile to simulate human users, VLAN traffic, and ISP link saturation.'
                    : 'No workloads match the selected search or filter criteria.'}
                </p>
                <button
                  onClick={() => {
                    setEditingWorkload(null);
                    setIsAssignmentModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create Workload
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWorkloads.map((w) => {
                  const downMbps = ((w.averageDownloadKbps || 0) / 1000).toFixed(1);
                  const upMbps = ((w.averageUploadKbps || 0) / 1000).toFixed(1);
                  const peakDownMbps = ((w.peakDownloadKbps || 0) / 1000).toFixed(1);
                  const peakUpMbps = ((w.peakUploadKbps || 0) / 1000).toFixed(1);
                  const effectiveUsers = Math.round((w.activeUsers || 0) * (w.concurrencyFactor || 0.4));

                  return (
                    <div
                      key={w.id}
                      className={`flex flex-col justify-between p-4.5 rounded-2xl border transition-all ${
                        w.enabled
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg'
                          : 'bg-slate-950/60 border-slate-900 opacity-60'
                      }`}
                    >
                      <div>
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                              {getCategoryIcon(w.profileCategory)}
                              {w.profileCategory.toUpperCase()}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getPriorityBadgeClass(
                                w.trafficPriority
                              )}`}
                            >
                              {w.trafficPriority.toUpperCase()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => toggleWorkloadEnabled(w.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                w.enabled
                                  ? 'text-cyan-400 hover:bg-cyan-500/10'
                                  : 'text-slate-500 hover:bg-slate-800'
                              }`}
                              title={w.enabled ? 'Disable Workload' : 'Enable Workload'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Workload Name & Scope */}
                        <h3 className="text-sm font-bold text-slate-100 truncate mb-1">{w.name}</h3>
                        <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium mb-3">
                          <Layers className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{getTargetDescription(w)}</span>
                        </div>

                        {/* Bandwidth Demand Figures */}
                        <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl space-y-2 mb-3">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-400 flex items-center gap-1">
                              <ArrowDown className="w-3.5 h-3.5 text-cyan-400" /> Downlink Demand:
                            </span>
                            <span className="text-slate-100 font-semibold">
                              {downMbps} Mbps{' '}
                              <span className="text-[10px] text-amber-400/90 font-normal">
                                (Peak {peakDownMbps}M)
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-400 flex items-center gap-1">
                              <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> Uplink Demand:
                            </span>
                            <span className="text-slate-100 font-semibold">
                              {upMbps} Mbps{' '}
                              <span className="text-[10px] text-purple-400/90 font-normal">
                                (Peak {peakUpMbps}M)
                              </span>
                            </span>
                          </div>

                          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <span>Sizing & Concurrency:</span>
                            <span className="font-mono text-cyan-300 font-medium">
                              {w.activeUsers} users @ {Math.round((w.concurrencyFactor || 0.4) * 100)}% ={' '}
                              {effectiveUsers} active
                            </span>
                          </div>
                        </div>

                        {/* Applications Tags */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(w.applications || []).slice(0, 3).map((app, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-400 border border-slate-700/60"
                            >
                              {app.name}
                            </span>
                          ))}
                          {(w.applications || []).length > 3 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800/80 text-slate-500">
                              +{(w.applications || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          Schedule: {w.activitySchedule || '24/7'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => duplicateWorkload(w.id)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Duplicate Workload"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingWorkload(w);
                              setIsAssignmentModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Workload"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteWorkload(w.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Workload"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Profile Library Sub-Tab */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Workload Profile Library</h3>
                <p className="text-xs text-slate-400">
                  Reusable application mixes and traffic patterns available across your project
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingProfile(null);
                  setIsProfileModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Custom Profile
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allProfiles.map((prof) => {
                const isCustom = prof.isCustom;
                return (
                  <div
                    key={prof.id}
                    className="p-4.5 bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                          {getCategoryIcon(prof.category)}
                          {prof.category.toUpperCase()}
                        </span>
                        {isCustom ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                            Custom Template
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                            Built-in Baseline
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-100 mb-1">{prof.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{prof.description}</p>

                      <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-1.5 mb-3 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Default Device Nodes:</span>
                          <span className="font-mono text-slate-200 font-medium">{prof.defaultDeviceCount}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Default Active Users:</span>
                          <span className="font-mono text-slate-200 font-medium">{prof.defaultActiveUsers}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Concurrency Ratio:</span>
                          <span className="font-mono text-cyan-400 font-medium">
                            {Math.round((prof.defaultConcurrencyFactor ?? 0.4) * 100)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Included Applications:</span>
                          <span className="font-mono text-slate-200 font-medium">
                            {prof.applications?.length || 0} apps
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setEditingWorkload(null);
                          setIsAssignmentModalOpen(true);
                        }}
                        className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        Assign To Network <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      {isCustom && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingProfile(prof);
                              setIsProfileModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const res = deleteWorkloadProfile(prof.id);
                              if (!res.success) {
                                alert(res.error || 'Failed to delete profile');
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      <WorkloadAssignmentModal
        isOpen={isAssignmentModalOpen}
        workload={editingWorkload}
        onClose={() => {
          setIsAssignmentModalOpen(false);
          setEditingWorkload(null);
        }}
        onSave={(data) => {
          if (editingWorkload) {
            updateWorkload(editingWorkload.id, data);
          } else {
            addWorkload(data);
          }
        }}
      />

      {/* Profile Modal */}
      <WorkloadProfileModal
        isOpen={isProfileModalOpen}
        profile={editingProfile}
        onClose={() => {
          setIsProfileModalOpen(false);
          setEditingProfile(null);
        }}
        onSave={(data) => {
          if (editingProfile) {
            updateWorkloadProfile(editingProfile.id, data);
          } else {
            addWorkloadProfile(data);
          }
        }}
      />
    </div>
  );
};
