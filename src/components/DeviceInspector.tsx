import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { PortMode, OpticalTransceiverType, MediaType } from '../types/network';
import { WorkloadAssignmentModal } from './WorkloadManager/WorkloadAssignmentModal';
import { DeviceWorkload } from '../types/ispWorkload';
import { hasRouterOsSupport } from '../services/routerOsConfigService';
import {
  Server,
  Router,
  Layers,
  Wifi,
  Globe,
  Monitor,
  Settings2,
  Trash2,
  X,
  Cable,
  Check,
  AlertTriangle,
  Info,
  Activity,
  Play,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Plus,
  Sliders,
  Terminal,
  Layout,
  PanelRightClose,
  HelpCircle,
} from 'lucide-react';

interface DeviceInspectorProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({ isOpen = true, onToggle }) => {
  const {
    activeProject,
    selectedDeviceId,
    selectedLinkId,
    selectedInterfaceId,
    trafficStats,
    customDevices,
    runPing,
    setSelectedDevice,
    setSelectedLink,
    setSelectedInterface,
    updateDevice,
    updateInterface,
    removeDevice,
    updateLink,
    removeLink,
    addWorkload,
    updateWorkload,
    openRouterConsole,
    openUserGuide,
  } = useNetworkStore();

  const [testTargetIp, setTestTargetIp] = useState('8.8.8.8');
  const [testResult, setTestResult] = useState<string | null>(null);

  const [ipInput, setIpInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  // Workload Modal state
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [editingWorkload, setEditingWorkload] = useState<DeviceWorkload | null>(null);

  // 1. Check if Device is Selected
  const selectedDevice = activeProject.devices.find((d) => d.id === selectedDeviceId);

  // 2. Check if Link is Selected
  const selectedLink = activeProject.links.find((l) => l.id === selectedLinkId);

  if (!isOpen) return null;

  if (!selectedDevice && !selectedLink) {
    return (
      <aside className="w-84 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full select-none text-slate-500 text-xs shrink-0 z-30 relative">
        <div className="p-2.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Inspector Panel</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openUserGuide('interface-connections')}
              title="Panduan Konfigurasi Interface & Connections"
              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {onToggle && (
              <button
                onClick={onToggle}
                title="Sembunyikan Inspector Panel (Perluas Canvas)"
                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 transition-colors"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col p-4 text-center justify-center items-center">
          <Settings2 className="w-8 h-8 text-slate-700 mb-2 stroke-[1.5]" />
          <span className="font-semibold text-slate-400">Inspector Panel</span>
          <span className="text-[11px] mt-1 max-w-[200px] leading-relaxed">
            Select a device or cable link on the canvas to configure interfaces, IP addressing, VLANs, and optics.
          </span>
        </div>
      </aside>
    );
  }

  // ==========================================
  // LINK INSPECTOR VIEW
  // ==========================================
  if (selectedLink) {
    const srcDev = activeProject.devices.find((d) => d.id === selectedLink.sourceDeviceId);
    const tgtDev = activeProject.devices.find((d) => d.id === selectedLink.targetDeviceId);
    const srcPort = srcDev?.interfaces.find((i) => i.id === selectedLink.sourceInterfaceId);
    const tgtPort = tgtDev?.interfaces.find((i) => i.id === selectedLink.targetInterfaceId);

    return (
      <aside className="w-84 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full select-none shrink-0 z-30 overflow-y-auto">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Physical Link Inspector</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openUserGuide('interface-connections')}
              title="Panduan Physical Link & Interface Connections"
              className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {onToggle && (
              <button
                onClick={onToggle}
                title="Sembunyikan Inspector Panel"
                className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setSelectedLink(null)}
              title="Deselect Link"
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Endpoints */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Endpoints</div>
            <div className="flex items-center justify-between text-slate-200 font-mono">
              <span>{srcDev?.name || 'Unknown'}:{srcPort?.name || 'port'}</span>
              <span className="text-slate-500">↔</span>
              <span>{tgtDev?.name || 'Unknown'}:{tgtPort?.name || 'port'}</span>
            </div>
          </div>

          {/* Media Type */}
          <div>
            <label className="block text-slate-400 text-[11px] mb-1 font-medium">Cable Media Type</label>
            <select
              value={selectedLink.mediaType}
              onChange={(e) => updateLink(selectedLink.id, { mediaType: e.target.value as MediaType })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="fiber-smf">Single-Mode Fiber (OS2 Yellow)</option>
              <option value="fiber-mmf">Multi-Mode Fiber (OM3/OM4 Aqua)</option>
              <option value="copper-cat6">Cat6 UTP Copper Cable</option>
              <option value="copper-cat6a">Cat6A STP 10G Shielded Copper</option>
              <option value="copper-cat5e">Cat5e Standard Copper Patch</option>
            </select>
          </div>

          {/* Cable Length */}
          <div>
            <div className="flex justify-between text-slate-400 text-[11px] mb-1">
              <span>Cable Length</span>
              <span className="font-mono text-cyan-400">{selectedLink.cableLengthMeters}m</span>
            </div>
            <input
              type="range"
              min="1"
              max={selectedLink.isFiber ? 10000 : 120}
              step={selectedLink.isFiber ? 10 : 1}
              value={selectedLink.cableLengthMeters}
              onChange={(e) => updateLink(selectedLink.id, { cableLengthMeters: parseInt(e.target.value, 10) })}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* Status */}
          <div className="p-3 rounded bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
            <span className="text-slate-400">Carrier Status:</span>
            <span
              className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                selectedLink.status === 'RUN'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {selectedLink.status}
            </span>
          </div>

          {/* Live Link Telemetry Stats */}
          {(() => {
            const stats = trafficStats[selectedLink.id];
            if (!stats) return null;
            return (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase">
                  <span>LIVE TRAFFIC COUNTERS</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Active</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">RX THROUGHPUT</span>
                    <span className="text-emerald-400 font-bold">{(stats.rxBps / 1_000_000).toFixed(1)} Mbps</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">TX THROUGHPUT</span>
                    <span className="text-cyan-400 font-bold">{(stats.txBps / 1_000_000).toFixed(1)} Mbps</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">PACKET RATE</span>
                    <span className="text-white">{stats.rxPps + stats.txPps} pps</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9.5px]">UTILIZATION</span>
                    <span className={stats.utilizationPercent > 80 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                      {stats.utilizationPercent}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Delete Link */}
          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => removeLink(selectedLink.id)}
              className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect & Remove Link</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // ==========================================
  // DEVICE & PORT INSPECTOR VIEW
  // ==========================================
  if (!selectedDevice) return null;

  const deviceHasRouterOs = hasRouterOsSupport(selectedDevice, customDevices);

  const currentIface =
    selectedDevice.interfaces.find((i) => i.id === selectedInterfaceId) ||
    selectedDevice.interfaces[0];

  const connectedLink = activeProject.links.find(
    (l) => l.sourceInterfaceId === currentIface.id || l.targetInterfaceId === currentIface.id
  );

  return (
    <aside className="w-88 border-l border-slate-800 bg-slate-900/95 flex flex-col h-full select-none shrink-0 z-30 overflow-y-auto">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2 min-w-0">
          <Settings2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <h3 className="text-xs font-bold text-white truncate">Device Inspector</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => openUserGuide('interface-connections')}
            title="Panduan Konfigurasi Perangkat & Interface"
            className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              title="Sembunyikan Inspector Panel (Perluas Canvas)"
              className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setSelectedDevice(null)}
            title="Deselect Device"
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 text-xs">
        {/* Device Properties Card */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider font-mono mb-1">
              Hostname
            </label>
            <input
              type="text"
              defaultValue={selectedDevice.name}
              onBlur={(e) => updateDevice(selectedDevice.id, { name: e.target.value.trim() || selectedDevice.name })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80 font-mono">
            <div>
              <span className="text-slate-500 block text-[9.5px]">MODEL</span>
              <span className="text-slate-200">{selectedDevice.modelName}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9.5px]">VENDOR</span>
              <span className="text-slate-200">{selectedDevice.vendor}</span>
            </div>
            {deviceHasRouterOs ? (
              <div>
                <span className="text-slate-500 block text-[9.5px]">ROUTEROS</span>
                <span className="text-cyan-400 font-semibold">{selectedDevice.routerOsVersion}</span>
              </div>
            ) : (
              <div>
                <span className="text-slate-500 block text-[9.5px]">CATEGORY</span>
                <span className="text-slate-300 uppercase font-semibold">{selectedDevice.category}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block text-[9.5px]">STATUS</span>
              <span className="text-emerald-400 font-bold">{selectedDevice.status}</span>
            </div>
          </div>

          {/* Custom Device Snapshot & Specifications */}
          {(() => {
            const customDef = customDevices.find((c) => c.id === selectedDevice.modelId);
            const isCustom = Boolean(customDef || selectedDevice.specificationVersion);
            const specVersion = selectedDevice.specificationVersion || (customDef ? customDef.specificationVersion : 1);
            const isCatalogNewer = customDef && specVersion && customDef.specificationVersion > specVersion;

            if (!isCustom) return null;

            return (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                      CUSTOM SNAPSHOT v{specVersion}
                    </span>
                    {customDef?.verificationStatus && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold flex items-center gap-1 ${
                        customDef.verificationStatus === 'VERIFIED'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                          : customDef.verificationStatus === 'PARTIALLY_VERIFIED'
                          ? 'bg-amber-950/60 text-amber-400 border border-amber-800/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        <ShieldCheck className="w-2.5 h-2.5" />
                        {customDef.verificationStatus}
                      </span>
                    )}
                  </div>
                  {customDef?.datasheetUrl && (
                    <a
                      href={customDef.datasheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                      title="Open Official Datasheet"
                    >
                      <span>Datasheet</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>

                {isCatalogNewer && (
                  <div className="text-[10px] bg-amber-950/30 border border-amber-800/40 rounded p-1.5 text-amber-300/90 leading-tight">
                    Catalog updated to v{customDef.specificationVersion}. This instance is locked to immutable snapshot v{specVersion}.
                  </div>
                )}

                {customDef?.hardware && (
                  <div className="bg-slate-900/80 rounded p-2 border border-slate-800 text-[10px] text-slate-400 space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">CPU</span>
                      <span className="text-slate-200">{customDef.hardware.cpuModel || customDef.hardware.cpuManufacturer || 'Custom'} ({customDef.hardware.cpuCores}C)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">RAM</span>
                      <span className="text-slate-200">{customDef.hardware.ramMb ? `${customDef.hardware.ramMb >= 1024 ? `${(customDef.hardware.ramMb/1024).toFixed(0)} GB` : `${customDef.hardware.ramMb} MB`}` : 'N/A'}</span>
                    </div>
                    {customDef.hardware.coolingSystem && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Cooling</span>
                        <span className="text-slate-300">{customDef.hardware.coolingSystem}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* RouterOS Management & Console Buttons (Only displayed if device supports RouterOS) */}
        {deviceHasRouterOs && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px] uppercase tracking-wider font-mono">
                <Terminal className="w-3.5 h-3.5" />
                <span>RouterOS Management</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-bold">
                RouterOS {selectedDevice.routerOsVersion}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openRouterConsole(selectedDevice.id, 'terminal')}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>CLI Terminal</span>
              </button>
              <button
                onClick={() => openRouterConsole(selectedDevice.id, 'winbox')}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Winbox GUI</span>
              </button>
            </div>
          </div>
        )}

        {/* WAN & CPE Circuit Termination Status */}
        {(() => {
          const linkedCpeCircuits = (activeProject.circuits || []).filter((c) => c.cpeDeviceId === selectedDevice.id);
          const terminatedRouterCircuits = (activeProject.circuits || []).filter((c) => c.targetRouterDeviceId === selectedDevice.id);

          if (linkedCpeCircuits.length === 0 && terminatedRouterCircuits.length === 0) return null;

          return (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px] uppercase tracking-wider font-mono">
                <Globe className="w-3.5 h-3.5" />
                <span>WAN & Internet Circuit Mapping</span>
              </div>

              {linkedCpeCircuits.map((c) => {
                const prov = (activeProject.ispProviders || []).find((p) => p.id === c.ispProviderId);
                const assign = (activeProject.cpeAssignments || []).find((a) => a.circuitId === c.id);

                return (
                  <div key={c.id} className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-sans">{c.circuitName}</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold">
                        {c.isPrimaryWan ? 'PRIMARY WAN' : 'BACKUP WAN'}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      ISP: <span className="text-slate-200">{prov?.name}</span> · Mode: <span className="text-emerald-400 uppercase font-bold">{assign?.connectionMode || 'Bridge'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                      <span>IP: {c.publicIp || 'Dynamic DHCP'}</span>
                      <span className="text-cyan-400 font-bold">{c.downloadBandwidth}{c.downloadUnit} ↓</span>
                    </div>
                  </div>
                );
              })}

              {terminatedRouterCircuits.map((c) => {
                const prov = (activeProject.ispProviders || []).find((p) => p.id === c.ispProviderId);
                const targetPort = selectedDevice.interfaces.find((i) => i.id === c.targetRouterInterfaceId);

                return (
                  <div key={c.id} className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-sans">WAN Interface: {targetPort?.name || 'Uplink'}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                        {c.isPrimaryWan ? 'DEFAULT GATEWAY' : 'BACKUP ROUTE'}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      Circuit: <span className="text-slate-200">{c.circuitName}</span> ({prov?.name})
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                      <span>Public IP: {c.publicIp || 'DHCP'}</span>
                      <span className="text-emerald-400 font-bold">{c.downloadBandwidth}{c.downloadUnit} ↓ / {c.uploadBandwidth}{c.uploadUnit} ↑</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Realistic Traffic & Workload Section */}
        {(() => {
          const directWorkloads = (activeProject.workloads || []).filter(
            (w) => w.targetDeviceId === selectedDevice.id || w.targetDeviceIds?.includes(selectedDevice.id)
          );
          const deviceVlanIds = Array.from(
            new Set(selectedDevice.interfaces.flatMap((i) => [i.pvid, ...(i.taggedVlans || [])]).filter(Boolean))
          );
          const vlanWorkloads = (activeProject.workloads || []).filter(
            (w) => w.scope === 'vlan' && w.targetVlanId && deviceVlanIds.includes(w.targetVlanId)
          );
          const totalAssignedWorkloads = [...directWorkloads, ...vlanWorkloads];

          return (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[10px] uppercase tracking-wider font-mono">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Assigned Workload ({totalAssignedWorkloads.length})</span>
                </div>
                <button
                  onClick={() => {
                    setEditingWorkload(null);
                    setIsWorkloadModalOpen(true);
                  }}
                  className="px-2 py-0.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-medium flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Assign
                </button>
              </div>

              {totalAssignedWorkloads.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic py-1">
                  No active traffic workload assigned to this device or its configured VLANs.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {totalAssignedWorkloads.map((w) => (
                    <div
                      key={w.id}
                      className="p-2 rounded bg-slate-900 border border-slate-800 space-y-1 text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 truncate">{w.name}</span>
                        <button
                          onClick={() => {
                            setEditingWorkload(w);
                            setIsWorkloadModalOpen(true);
                          }}
                          className="text-[10px] text-cyan-400 hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>{w.scope === 'vlan' ? `VLAN ${w.targetVlanId}` : 'Direct'}</span>
                        <span className="text-cyan-300 font-semibold">
                          ↓ {((w.averageDownloadKbps || 0) / 1000).toFixed(1)}M / ↑ {((w.averageUploadKbps || 0) / 1000).toFixed(1)}M
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {w.activeUsers} Users ({Math.round((w.concurrencyFactor || 0.4) * 100)}% concurrency)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Physical Port Faceplate Selector */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-300">Port Selector</span>
            <span className="text-[10px] text-slate-500 font-mono">{selectedDevice.interfaces.length} Ports</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-950/50 rounded border border-slate-800/80">
            {selectedDevice.interfaces.map((iface) => {
              const isSelected = currentIface.id === iface.id;
              const isLinked = activeProject.links.some(
                (l) => l.sourceInterfaceId === iface.id || l.targetInterfaceId === iface.id
              );
              const isSfp = iface.type === 'sfp' || iface.type === 'sfp-plus';

              return (
                <button
                  key={iface.id}
                  onClick={() => setSelectedInterface(iface.id)}
                  className={`p-1.5 rounded flex flex-col items-center justify-center text-[10px] font-mono border transition-all ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-1 ring-cyan-500/30'
                      : isLinked
                      ? 'bg-slate-800/80 border-slate-700 text-slate-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="truncate w-full text-center">{iface.name}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLinked
                          ? isSfp
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                          : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-[8px] text-slate-500 uppercase">{iface.type.slice(0, 3)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Interface Config Form */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-white font-mono text-xs">{currentIface.name}</span>
            <button
              onClick={() =>
                updateInterface(selectedDevice.id, currentIface.id, {
                  adminState: currentIface.adminState === 'up' ? 'down' : 'up',
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
                currentIface.adminState === 'up'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              ADMIN {currentIface.adminState}
            </button>
          </div>

          {/* IP Address & Prefix */}
          <div>
            <label className="block text-[10px] text-slate-400 font-medium mb-1">
              IP Address (CIDR Notation)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="e.g. 192.168.88.1/24"
                defaultValue={currentIface.ipAddress || ''}
                key={currentIface.id}
                onBlur={(e) =>
                  updateInterface(selectedDevice.id, currentIface.id, {
                    ipAddress: e.target.value.trim() || undefined,
                  })
                }
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Example: 103.144.20.2/30 for WAN or 10.20.0.1/24 for LAN gateway.
            </span>
          </div>

          {/* Port Mode & VLAN */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 font-medium mb-1">Port Mode</label>
              <select
                value={currentIface.mode}
                onChange={(e) =>
                  updateInterface(selectedDevice.id, currentIface.id, {
                    mode: e.target.value as PortMode,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="access">Access (LAN)</option>
                <option value="trunk">Trunk (VLANs)</option>
                <option value="wan">WAN Uplink</option>
                <option value="routed">L3 Routed</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 font-medium mb-1">PVID (VLAN)</label>
              <input
                type="number"
                min="1"
                max="4094"
                value={currentIface.pvid || 1}
                onChange={(e) =>
                  updateInterface(selectedDevice.id, currentIface.id, {
                    pvid: parseInt(e.target.value, 10) || 1,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Optical Transceiver Slot if SFP / SFP+ */}
          {(currentIface.type === 'sfp' || currentIface.type === 'sfp-plus') && (
            <div>
              <label className="block text-[10px] text-slate-400 font-medium mb-1">
                Installed SFP/SFP+ Transceiver Optic
              </label>
              <select
                value={currentIface.transceiver || 'none'}
                onChange={(e) =>
                  updateInterface(selectedDevice.id, currentIface.id, {
                    transceiver: e.target.value as OpticalTransceiverType,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="none">-- Empty SFP Cage --</option>
                <option value="sfpplus-10g-lr">10G SFP+ LR (Single-Mode 1310nm 10km)</option>
                <option value="sfpplus-10g-sr">10G SFP+ SR (Multi-Mode 850nm 300m)</option>
                <option value="sfpplus-10g-er">10G SFP+ ER (Single-Mode 1550nm 40km)</option>
                <option value="sfpplus-10g-bidi-u">10G BiDi Up (Tx1270/Rx1330 10km)</option>
                <option value="sfpplus-10g-bidi-d">10G BiDi Down (Tx1330/Rx1270 10km)</option>
                <option value="sfp-1g-lx">1G SFP LX (Single-Mode 1310nm 10km)</option>
                <option value="sfp-1g-sx">1G SFP SX (Multi-Mode 850nm 550m)</option>
                <option value="sfpplus-10g-rj45">10G Copper Module (S+RJ10)</option>
                <option value="sfp-1g-rj45">1G Copper Module (S-RJ01)</option>
              </select>
            </div>
          )}

          {/* Connected Link Status */}
          {connectedLink ? (
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-slate-300">
                <span>Link Carrier:</span>
                <span className="text-emerald-400 font-bold">{connectedLink.speed} · {connectedLink.mediaType}</span>
              </div>
              <button
                onClick={() => removeLink(connectedLink.id)}
                className="w-full py-1 mt-1 text-[10px] text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded transition-colors"
              >
                Disconnect This Port
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic">
              Port currently unplugged. Click this port on canvas to connect.
            </div>
          )}
        </div>

        {/* Quick Ping & Connectivity Prober */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Quick Ping Prober
            </span>
            <span className="text-[9px] text-slate-500 font-mono">From: {selectedDevice.name}</span>
          </div>

          <div className="flex gap-1.5">
            <input
              type="text"
              value={testTargetIp}
              onChange={(e) => setTestTargetIp(e.target.value)}
              placeholder="Target IP (e.g. 8.8.8.8)"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => {
                const res = runPing(selectedDevice.id, testTargetIp.trim(), 'ICMP');
                setTestResult(res.summary);
              }}
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors shrink-0"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Ping</span>
            </button>
          </div>

          {testResult && (
            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[10.5px] font-mono leading-relaxed text-slate-300">
              <div className="text-[9.5px] text-slate-500 mb-0.5 uppercase">Last Probe Output:</div>
              <div>{testResult}</div>
            </div>
          )}
        </div>

        {/* Delete Device Button */}
        <div className="pt-2 border-t border-slate-800">
          <button
            onClick={() => removeDevice(selectedDevice.id)}
            className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Device from Topology</span>
          </button>
        </div>
      </div>

      {/* Workload Assignment Modal */}
      <WorkloadAssignmentModal
        isOpen={isWorkloadModalOpen}
        workload={editingWorkload}
        initialDeviceId={selectedDevice?.id}
        onClose={() => {
          setIsWorkloadModalOpen(false);
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
    </aside>
  );
};
