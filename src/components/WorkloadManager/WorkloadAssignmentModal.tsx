import React, { useState, useEffect, useMemo } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  DeviceWorkload,
  WorkloadScope,
  WorkloadProfileCategory,
  TrafficPriority,
  ApplicationTrafficModel,
  WorkloadProfile,
} from '../../types/ispWorkload';
import { DEFAULT_WORKLOAD_PROFILES } from '../../data/defaultWorkloadProfiles';
import {
  X,
  Activity,
  Layers,
  Users,
  Sliders,
  Sparkles,
  ArrowDown,
  ArrowUp,
  Check,
  AlertCircle,
  Network,
  Cpu,
  Clock,
  Shield,
  Plus,
  Trash2,
} from 'lucide-react';

interface WorkloadAssignmentModalProps {
  isOpen: boolean;
  workload?: DeviceWorkload | null;
  initialDeviceId?: string;
  onClose: () => void;
  onSave: (data: Omit<DeviceWorkload, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const WorkloadAssignmentModal: React.FC<WorkloadAssignmentModalProps> = ({
  isOpen,
  workload,
  initialDeviceId,
  onClose,
  onSave,
}) => {
  const { activeProject } = useNetworkStore();
  const devices = activeProject.devices || [];
  const vlans = activeProject.vlans || [];
  const customProfiles = activeProject.workloadProfiles;

  // Merge built-in profiles and custom saved profiles with stable memoization
  const allProfiles = useMemo(() => {
    const map = new Map<string, WorkloadProfile>();
    DEFAULT_WORKLOAD_PROFILES.forEach((p) => map.set(p.id, p));
    (customProfiles || []).forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [customProfiles]);

  const [name, setName] = useState('');
  const [scope, setScope] = useState<WorkloadScope>('vlan');
  const [targetDeviceId, setTargetDeviceId] = useState<string>('');
  const [targetDeviceIds, setTargetDeviceIds] = useState<string[]>([]);
  const [targetVlanId, setTargetVlanId] = useState<number>(vlans[0]?.id || 10);
  const [targetSubnet, setTargetSubnet] = useState<string>('192.168.10.0/24');

  const [selectedProfileId, setSelectedProfileId] = useState<string>(allProfiles[0]?.id || 'profile-office');
  const [profileCategory, setProfileCategory] = useState<WorkloadProfileCategory>('office');

  const [deviceCount, setDeviceCount] = useState<number>(20);
  const [activeUsers, setActiveUsers] = useState<number>(40);
  const [concurrencyFactor, setConcurrencyFactor] = useState<number>(0.4);
  const [activitySchedule, setActivitySchedule] = useState<'24/7' | 'business-hours' | 'evening-peak' | 'custom'>('business-hours');
  const [trafficPriority, setTrafficPriority] = useState<TrafficPriority>('normal');
  const [enabled, setEnabled] = useState<boolean>(true);

  const [applications, setApplications] = useState<ApplicationTrafficModel[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize modal state only when modal opens or target workload changes
  useEffect(() => {
    if (!isOpen) return;

    if (workload) {
      setName(workload.name);
      setScope(workload.scope);
      setTargetDeviceId(workload.targetDeviceId || '');
      setTargetDeviceIds(workload.targetDeviceIds || []);
      setTargetVlanId(workload.targetVlanId || vlans[0]?.id || 10);
      setTargetSubnet(workload.targetSubnet || '192.168.10.0/24');
      setSelectedProfileId(workload.profileId);
      setProfileCategory(workload.profileCategory);
      setDeviceCount(workload.deviceCount || 20);
      setActiveUsers(workload.activeUsers || 40);
      setConcurrencyFactor(workload.concurrencyFactor ?? 0.4);
      setActivitySchedule(workload.activitySchedule || 'business-hours');
      setTrafficPriority(workload.trafficPriority || 'normal');
      setEnabled(workload.enabled !== undefined ? workload.enabled : true);
      setApplications(workload.applications ? JSON.parse(JSON.stringify(workload.applications)) : []);
    } else {
      const defaultProf = allProfiles[0] || DEFAULT_WORKLOAD_PROFILES[0];
      const initialDev = initialDeviceId ? devices.find((d) => d.id === initialDeviceId) : null;

      if (initialDev) {
        setName(`${initialDev.name} Workload`);
        setScope('device');
        setTargetDeviceId(initialDev.id);
      } else {
        setName('Campus General Traffic');
        setScope(vlans.length > 0 ? 'vlan' : 'device');
        setTargetDeviceId(devices[0]?.id || '');
      }

      setTargetDeviceIds([]);
      setTargetVlanId(vlans[0]?.id || 10);
      setTargetSubnet('192.168.10.0/24');
      setSelectedProfileId(defaultProf.id);
      setProfileCategory(defaultProf.category);
      setDeviceCount(defaultProf.defaultDeviceCount || 20);
      setActiveUsers(defaultProf.defaultActiveUsers || 40);
      setConcurrencyFactor(defaultProf.defaultConcurrencyFactor ?? 0.4);
      setActivitySchedule('business-hours');
      setTrafficPriority('normal');
      setEnabled(true);
      setApplications(JSON.parse(JSON.stringify(defaultProf.applications || [])));
    }
    setValidationError(null);
  }, [isOpen, workload?.id, initialDeviceId]);

  // When changing the base profile, load its template values
  const handleProfileSelect = (profId: string) => {
    setSelectedProfileId(profId);
    const prof = allProfiles.find((p) => p.id === profId);
    if (prof) {
      setProfileCategory(prof.category);
      setDeviceCount(prof.defaultDeviceCount);
      setActiveUsers(prof.defaultActiveUsers);
      setConcurrencyFactor(prof.defaultConcurrencyFactor);
      setApplications(JSON.parse(JSON.stringify(prof.applications || [])));
    }
  };

  // Live Demand Calculations
  const calculatedMetrics = useMemo(() => {
    const effectiveUsers = Math.max(1, activeUsers * concurrencyFactor);
    let sumDownKbps = 0;
    let sumUpKbps = 0;
    let sumAvgDownKbps = 0;
    let sumAvgUpKbps = 0;
    let sumPeakDownKbps = 0;
    let sumPeakUpKbps = 0;

    for (const app of applications) {
      const p = Math.max(0.05, Math.min(1.0, app.activityProbability || 0.5));
      sumDownKbps += app.downloadRateKbps * p * effectiveUsers;
      sumUpKbps += app.uploadRateKbps * p * effectiveUsers;
      sumAvgDownKbps += app.averageBitrateKbps * p * effectiveUsers;
      sumAvgUpKbps += app.averageBitrateKbps * 0.45 * p * effectiveUsers;
      sumPeakDownKbps += app.peakBitrateKbps * Math.min(1.0, p * 1.4) * effectiveUsers;
      sumPeakUpKbps += app.peakBitrateKbps * 0.45 * Math.min(1.0, p * 1.4) * effectiveUsers;
    }

    return {
      effectiveUsers: Math.round(effectiveUsers * 10) / 10,
      downloadDemandKbps: Math.round(sumDownKbps),
      uploadDemandKbps: Math.round(sumUpKbps),
      averageDownMbps: Math.round((sumAvgDownKbps / 1000) * 100) / 100,
      averageUpMbps: Math.round((sumAvgUpKbps / 1000) * 100) / 100,
      peakDownMbps: Math.round((sumPeakDownKbps / 1000) * 100) / 100,
      peakUpMbps: Math.round((sumPeakUpKbps / 1000) * 100) / 100,
    };
  }, [applications, activeUsers, concurrencyFactor]);

  if (!isOpen) return null;

  const handleToggleDeviceGroup = (devId: string) => {
    setTargetDeviceIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId]
    );
  };

  const handleUpdateApp = (index: number, updates: Partial<ApplicationTrafficModel>) => {
    setApplications((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveApp = (index: number) => {
    setApplications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddApp = () => {
    const newApp: ApplicationTrafficModel = {
      id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Custom Application',
      category: 'General',
      downloadRateKbps: 2000,
      uploadRateKbps: 500,
      averageBitrateKbps: 800,
      peakBitrateKbps: 3000,
      activityProbability: 0.4,
      concurrentSessions: 4,
      trafficPriority: 'normal',
      latencySensitivity: 'medium',
    };
    setApplications([...applications, newApp]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Workload name is required.');
      return;
    }

    if (scope === 'device' && !targetDeviceId) {
      setValidationError('Please select a target device.');
      return;
    }
    if (scope === 'group' && targetDeviceIds.length === 0) {
      setValidationError('Please select at least one device in the group.');
      return;
    }
    if (applications.length === 0) {
      setValidationError('At least one application must be included in the workload mix.');
      return;
    }

    onSave({
      name: name.trim(),
      scope,
      targetDeviceId: scope === 'device' ? targetDeviceId : undefined,
      targetDeviceIds: scope === 'group' ? targetDeviceIds : undefined,
      targetVlanId: scope === 'vlan' ? targetVlanId : undefined,
      targetSubnet: scope === 'subnet' ? targetSubnet : undefined,
      profileId: selectedProfileId,
      profileCategory,
      deviceCount: Math.max(1, deviceCount),
      activeUsers: Math.max(1, activeUsers),
      concurrencyFactor: Math.min(1.0, Math.max(0.01, concurrencyFactor)),
      activitySchedule,
      trafficPriority,
      downloadDemandKbps: calculatedMetrics.downloadDemandKbps,
      uploadDemandKbps: calculatedMetrics.uploadDemandKbps,
      averageDownloadKbps: Math.round(calculatedMetrics.averageDownMbps * 1000),
      averageUploadKbps: Math.round(calculatedMetrics.averageUpMbps * 1000),
      peakDownloadKbps: Math.round(calculatedMetrics.peakDownMbps * 1000),
      peakUploadKbps: Math.round(calculatedMetrics.peakUpMbps * 1000),
      applications,
      enabled,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {workload ? 'Edit Device Workload Assignment' : 'Assign Realistic Network Workload'}
              </h2>
              <p className="text-xs text-slate-400">
                Model realistic traffic generation across devices, VLANs, and client endpoints
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Workload Identity & Target Scope */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 1. Workload Scope & Target Network
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Workload Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Campus Civitas Wi-Fi Workload"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Scope Level
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as WorkloadScope)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="vlan">VLAN Broadcast Domain (e.g. Staff, Students)</option>
                  <option value="device">Single Target Device</option>
                  <option value="group">Device Group (Multi-select)</option>
                  <option value="subnet">IP Subnet Scope</option>
                </select>
              </div>
            </div>

            {/* Target Selectors */}
            {scope === 'vlan' && (
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Target VLAN
                </label>
                {vlans.length > 0 ? (
                  <select
                    value={targetVlanId}
                    onChange={(e) => setTargetVlanId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                  >
                    {vlans.map((v) => (
                      <option key={v.id} value={v.id}>
                        VLAN {v.id} — {v.name} ({v.subnet || 'No subnet'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-amber-400">
                    No VLANs defined in topology. You can define VLANs in the VLAN tab or select single device scope.
                  </p>
                )}
              </div>
            )}

            {scope === 'device' && (
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Select Target Device
                </label>
                <select
                  value={targetDeviceId}
                  onChange={(e) => setTargetDeviceId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.category.toUpperCase()} — {d.modelName})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scope === 'group' && (
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>Select Group Devices ({targetDeviceIds.length} selected)</span>
                  <button
                    type="button"
                    onClick={() => setTargetDeviceIds(devices.map((d) => d.id))}
                    className="text-cyan-400 hover:underline text-[11px]"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                  {devices.map((d) => {
                    const isChecked = targetDeviceIds.includes(d.id);
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => handleToggleDeviceGroup(d.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                          isChecked
                            ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                            : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            isChecked ? 'bg-cyan-500 border-cyan-400 text-slate-900' : 'border-slate-600'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span className="truncate">{d.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {scope === 'subnet' && (
              <div className="p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
                <label className="block text-xs font-medium text-slate-300 mb-1">Target IP Subnet</label>
                <input
                  type="text"
                  value={targetSubnet}
                  onChange={(e) => setTargetSubnet(e.target.value)}
                  placeholder="e.g. 10.10.20.0/24"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* Section 2: Base Profile & Workload Sizing */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Sliders className="w-4 h-4" /> 2. Profile Template & Capacity Sizing
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Load Profile Template
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => handleProfileSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                >
                  {allProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.category.toUpperCase()}]{p.isCustom ? ' (Custom)' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {allProfiles.find((p) => p.id === selectedProfileId)?.description}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Traffic Priority QoS
                </label>
                <select
                  value={trafficPriority}
                  onChange={(e) => setTrafficPriority(e.target.value as TrafficPriority)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="critical">Critical (Voice / Control Plane / VIP)</option>
                  <option value="high">High (Enterprise Real-Time / Zoom)</option>
                  <option value="normal">Normal (Standard Web & Office)</option>
                  <option value="low">Low (Background Sync / P2P)</option>
                  <option value="best-effort">Best Effort</option>
                </select>
              </div>
            </div>

            {/* Sizing Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Device Nodes</span>
                  <span className="font-mono font-bold text-cyan-400">{deviceCount}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={250}
                  value={deviceCount}
                  onChange={(e) => setDeviceCount(parseInt(e.target.value) || 1)}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">Physical endpoints / PCs</span>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Active Users</span>
                  <span className="font-mono font-bold text-cyan-400">{activeUsers}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={500}
                  value={activeUsers}
                  onChange={(e) => setActiveUsers(parseInt(e.target.value) || 1)}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">Human consumers</span>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">Concurrency Factor</span>
                  <span className="font-mono font-bold text-cyan-400">
                    {Math.round(concurrencyFactor * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(concurrencyFactor * 100)}
                  onChange={(e) => setConcurrencyFactor(parseInt(e.target.value) / 100)}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">
                  = {calculatedMetrics.effectiveUsers} concurrent active users
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Live Bandwidth Demand Gauge & Telemetry Preview */}
          <div className="p-4 bg-gradient-to-br from-slate-950 to-slate-900 border border-cyan-500/30 rounded-xl shadow-lg shadow-cyan-950/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Calculated Bandwidth Demand (Live Preview)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Simulation Enabled</span>
                <button
                  type="button"
                  onClick={() => setEnabled(!enabled)}
                  className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
                    enabled ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 mb-1 font-medium">
                  <ArrowDown className="w-3.5 h-3.5" /> Average Downlink
                </div>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {calculatedMetrics.averageDownMbps} <span className="text-xs font-normal text-slate-400">Mbps</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {(calculatedMetrics.downloadDemandKbps / 1000).toFixed(1)} Mbps demand pool
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1 font-medium">
                  <ArrowUp className="w-3.5 h-3.5" /> Average Uplink
                </div>
                <div className="text-xl font-bold font-mono text-slate-100">
                  {calculatedMetrics.averageUpMbps} <span className="text-xs font-normal text-slate-400">Mbps</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {(calculatedMetrics.uploadDemandKbps / 1000).toFixed(1)} Mbps demand pool
                </div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1 font-medium">
                  <ArrowDown className="w-3.5 h-3.5" /> Peak Downlink
                </div>
                <div className="text-xl font-bold font-mono text-amber-300">
                  {calculatedMetrics.peakDownMbps} <span className="text-xs font-normal text-slate-400">Mbps</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Burst capacity spike</div>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-purple-400 mb-1 font-medium">
                  <ArrowUp className="w-3.5 h-3.5" /> Peak Uplink
                </div>
                <div className="text-xl font-bold font-mono text-purple-300">
                  {calculatedMetrics.peakUpMbps} <span className="text-xs font-normal text-slate-400">Mbps</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Burst upload spike</div>
              </div>
            </div>
          </div>

          {/* Section 4: Application Mix Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  4. Traffic Mix Applications ({applications.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Adjust individual duty cycles or bitrates for this specific assignment
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add App
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {applications.map((app, idx) => (
                <div
                  key={app.id || idx}
                  className="flex items-center justify-between gap-3 p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 truncate">{app.name}</span>
                      <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px] text-slate-300">
                        {app.category || 'General'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-1 font-mono">
                      <span>↓ {app.downloadRateKbps} Kbps</span>
                      <span>↑ {app.uploadRateKbps} Kbps</span>
                      <span>Peak: {app.peakBitrateKbps} Kbps</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-24 text-right">
                      <span className="text-[10px] text-slate-400 block">Duty Cycle</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {Math.round((app.activityProbability || 0.5) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={Math.round((app.activityProbability || 0.5) * 100)}
                      onChange={(e) =>
                        handleUpdateApp(idx, { activityProbability: parseInt(e.target.value) / 100 })
                      }
                      className="w-20 accent-cyan-400 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveApp(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove App"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Check className="w-4 h-4" /> {workload ? 'Save Changes' : 'Assign Workload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
