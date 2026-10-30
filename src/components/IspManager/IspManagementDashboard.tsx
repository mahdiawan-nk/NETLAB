import React, { useState, useMemo } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  InternetCircuit,
  IspProvider,
  BandwidthUnit,
} from '../../types/network';
import { IspProviderModal } from './IspProviderModal';
import { InternetCircuitModal } from './InternetCircuitModal';
import { CpeWanMappingModal } from './CpeWanMappingModal';
import {
  Globe,
  Network,
  Plus,
  Search,
  Star,
  Copy,
  Trash2,
  Edit2,
  ExternalLink,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Activity,
  ArrowDownUp,
  Building2,
  Shield,
  Layers,
  Cable,
} from 'lucide-react';


function toMbps(val: number, unit: BandwidthUnit): number {
  if (unit === 'Gbps') return val * 1000;
  if (unit === 'Kbps') return val / 1000;
  return val;
}

const EMPTY_PROVIDERS: IspProvider[] = [];
const EMPTY_CIRCUITS: InternetCircuit[] = [];

export const IspManagementDashboard: React.FC = () => {
  const {
    activeProject,
    addIspProvider,
    updateIspProvider,
    deleteIspProvider,
    duplicateIspProvider,
    toggleIspProviderStatus,
    addCircuit,
    updateCircuit,
    deleteCircuit,
    duplicateCircuit,
    setPrimaryCircuit,
    circuitTelemetry,
  } = useNetworkStore();

  const providers = activeProject.ispProviders || EMPTY_PROVIDERS;
  const circuits = activeProject.circuits || EMPTY_CIRCUITS;

  // Tab view state
  const [subTab, setSubTab] = useState<'circuits' | 'providers'>('circuits');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<IspProvider | null>(null);

  const [isCircuitModalOpen, setIsCircuitModalOpen] = useState(false);
  const [editingCircuit, setEditingCircuit] = useState<InternetCircuit | null>(null);

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappingCircuit, setMappingCircuit] = useState<InternetCircuit | null>(null);

  // Deletion alert modal state
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [circuitToDelete, setCircuitToDelete] = useState<InternetCircuit | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<IspProvider | null>(null);


  // Computed summary metrics
  const summary = useMemo(() => {
    let totalDownMbps = 0;
    let totalUpMbps = 0;
    let activeCircuitsCount = 0;

    for (const c of circuits) {
      if (c.status === 'active') {
        activeCircuitsCount++;
        totalDownMbps += toMbps(c.downloadBandwidth, c.downloadUnit);
        totalUpMbps += toMbps(c.uploadBandwidth, c.uploadUnit);
      }
    }

    const primary = circuits.find((c) => c.isPrimaryWan && c.status === 'active') || circuits.find((c) => c.isPrimaryWan);

    return {
      totalProviders: providers.length,
      totalCircuits: circuits.length,
      activeCircuits: activeCircuitsCount,
      totalDownMbps: totalDownMbps.toFixed(0),
      totalUpMbps: totalUpMbps.toFixed(0),
      primaryCircuit: primary,
    };
  }, [providers, circuits]);

  // Filtered circuits
  const filteredCircuits = useMemo(() => {
    return circuits.filter((c) => {
      const provider = providers.find((p) => p.id === c.ispProviderId);
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        c.circuitName.toLowerCase().includes(q) ||
        (c.publicIp && c.publicIp.toLowerCase().includes(q)) ||
        c.serviceType.toLowerCase().includes(q) ||
        (provider && provider.name.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.status === 'active') ||
        (statusFilter === 'inactive' && c.status !== 'active');

      return matchSearch && matchStatus;
    });
  }, [circuits, providers, searchQuery, statusFilter]);

  // Filtered providers
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'all' || p.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [providers, searchQuery, statusFilter]);

  // Handlers
  const handleSaveProvider = (providerData: Omit<IspProvider, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingProvider) {
      updateIspProvider(editingProvider.id, providerData);
    } else {
      addIspProvider(providerData);
    }
  };

  const handleSaveCircuit = (circuitData: Omit<InternetCircuit, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingCircuit) {
      updateCircuit(editingCircuit.id, circuitData);
    } else {
      addCircuit(circuitData);
    }
  };

  const handleDeleteProvider = (id: string) => {
    const res = deleteIspProvider(id);
    if (!res.success) {
      setDeleteError(res.error || 'Failed to delete provider.');
    } else {
      setProviderToDelete(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden font-sans text-xs">
      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-950/60 border-b border-slate-800">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">ISP Providers</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold text-white font-mono">{summary.totalProviders}</span>
            <span className="text-[10px] text-slate-500 font-sans">companies</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Total Circuits</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-lg font-bold text-cyan-400 font-mono">{summary.totalCircuits}</span>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold">({summary.activeCircuits} active)</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Aggregate Down</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-emerald-400 font-mono">{summary.totalDownMbps}</span>
            <span className="text-[10px] text-slate-400 font-mono">Mbps ↓</span>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Aggregate Up</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-lg font-bold text-cyan-400 font-mono">{summary.totalUpMbps}</span>
            <span className="text-[10px] text-slate-400 font-mono">Mbps ↑</span>
          </div>
        </div>

        <div className="col-span-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-amber-400 uppercase font-mono tracking-wider flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400" />
              <span>Primary WAN Gateway</span>
            </span>
            {summary.primaryCircuit && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold">
                DEFAULT 0.0.0.0/0
              </span>
            )}
          </div>
          <div className="mt-1 truncate">
            {summary.primaryCircuit ? (
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs truncate mr-2">
                  {summary.primaryCircuit.circuitName}
                </span>
                <span className="text-[11px] font-mono text-cyan-400 shrink-0 font-bold">
                  {summary.primaryCircuit.downloadBandwidth}{summary.primaryCircuit.downloadUnit} ↓ / {summary.primaryCircuit.uploadBandwidth}{summary.primaryCircuit.uploadUnit} ↑
                </span>
              </div>
            ) : (
              <span className="text-slate-500 italic">No primary WAN set</span>
            )}
          </div>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/60">
        {/* Sub-tab navigation */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setSubTab('circuits')}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all ${
              subTab === 'circuits'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Internet Circuits ({circuits.length})</span>
          </button>
          <button
            onClick={() => setSubTab('providers')}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-all ${
              subTab === 'providers'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>ISP Providers ({providers.length})</span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5 flex-1 max-w-lg justify-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={subTab === 'circuits' ? 'Search circuits, IP, or type...' : 'Search providers...'}
              className="w-full bg-slate-800/90 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {subTab === 'circuits' ? (
            <button
              onClick={() => {
                setEditingCircuit(null);
                setIsCircuitModalOpen(true);
              }}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Circuit</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingProvider(null);
                setIsProviderModalOpen(true);
              }}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add ISP Provider</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/20">
        {/* SUBTAB 1: CIRCUITS LIST */}
        {subTab === 'circuits' && (
          <div className="space-y-3">
            {filteredCircuits.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                <Network className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-300">No Internet Circuits Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Provision internet circuits to connect your campus topology to high-speed fiber or satellite transit.
                </p>
                <button
                  onClick={() => {
                    setEditingCircuit(null);
                    setIsCircuitModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Provision First Circuit</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {filteredCircuits.map((circ) => {
                  const provider = providers.find((p) => p.id === circ.ispProviderId);
                  const isPrimary = circ.isPrimaryWan;

                  return (
                    <div
                      key={circ.id}
                      className={`rounded-xl border p-4 transition-all duration-150 flex flex-col justify-between ${
                        isPrimary
                          ? 'bg-slate-900 border-amber-500/40 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/20'
                          : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white hover:text-cyan-400 transition-colors">
                                {circ.circuitName}
                              </h4>
                              {isPrimary ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[9.5px] font-bold flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-amber-300" />
                                  <span>PRIMARY WAN</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[9.5px] font-semibold">
                                  BACKUP WAN
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Provider: <strong className="text-cyan-300 font-medium">{provider?.name || 'Unknown ISP'}</strong> · <span className="capitalize">{circ.serviceType}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                circ.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : circ.status === 'standby'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {circ.status}
                            </span>
                          </div>
                        </div>

                        {/* Bandwidth & CIR Matrix */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 font-mono text-xs mb-3">
                          <div>
                            <span className="text-[9.5px] text-slate-500 block uppercase">Nominal Down</span>
                            <span className="text-emerald-400 font-bold">
                              {circ.downloadBandwidth} {circ.downloadUnit}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-500 block uppercase">Nominal Up</span>
                            <span className="text-cyan-400 font-bold">
                              {circ.uploadBandwidth} {circ.uploadUnit}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-500 block uppercase">CIR Guarantee</span>
                            <span className={circ.downloadCir ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                              {circ.downloadCir ? `${circ.downloadCir}M ↓ / ${circ.uploadCir}M ↑` : 'Best Effort'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9.5px] text-slate-500 block uppercase">Contention</span>
                            <span className="text-purple-300 font-bold">
                              {circ.contentionRatio}
                            </span>
                          </div>
                        </div>

                        {/* Network SLA Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300 font-mono border-t border-slate-800/60 pt-2.5 mb-3">
                          <div>
                            <span className="text-slate-500 block text-[9.5px]">PUBLIC IP</span>
                            <span className="text-white font-medium">{circ.publicIp || 'DHCP Dynamic'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9.5px]">GATEWAY / SUBNET</span>
                            <span className="text-slate-300 truncate block">{circ.gatewayIp || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9.5px]">SLA / LATENCY</span>
                            <span className="text-emerald-400 font-medium">
                              {circ.slaPercent || 99.5}% · {circ.latencyMs || 5}ms
                            </span>
                          </div>
                        </div>

                        {/* CPE & WAN Router Mapping Status */}
                        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[10.5px] font-mono flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5 truncate mr-2">
                            <Cable className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="text-slate-500 font-sans text-[10px]">Termination:</span>
                            {circ.cpeDeviceId ? (
                              <span className="text-cyan-300 font-semibold truncate">
                                {activeProject.devices.find((d) => d.id === circ.cpeDeviceId)?.name || 'CPE'} 
                                <span className="text-slate-500"> ➔ </span>
                                {circ.targetRouterDeviceId ? (
                                  <span className="text-emerald-400 font-bold">
                                    {activeProject.devices.find((d) => d.id === circ.targetRouterDeviceId)?.name || 'Router'}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">No Router Port</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-amber-400/80 italic text-[10px] font-sans">
                                Unmapped (Not linked to Modem/Router)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setMappingCircuit(circ);
                              setIsMappingModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-[10px] font-sans font-semibold shrink-0 transition-colors"
                          >
                            {circ.cpeDeviceId ? 'Configure Mapping' : 'Map CPE & WAN'}
                          </button>
                        </div>

                        {/* Live Circuit Simulation Telemetry */}
                        {(() => {
                          const telem = circuitTelemetry[circ.id];
                          if (!telem) return null;

                          return (
                            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2 mb-2.5 text-xs font-mono">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1 font-sans">
                                  <Activity className="w-3 h-3" /> Live Capacity Telemetry
                                </span>
                                <div className="flex items-center gap-1">
                                  {telem.isCirViolated && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                      CIR VIOLATION
                                    </span>
                                  )}
                                  {telem.droppedDownMbps > 0 && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
                                      SATURATED
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Progress Bars for Down/Up */}
                              <div className="space-y-1.5 text-[11px]">
                                <div>
                                  <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span>Downlink: <strong className="text-white">{telem.deliveredDownMbps} Mbps</strong> / {circ.downloadBandwidth}M</span>
                                    <span className={telem.utilizationDownPercent > 80 ? 'text-amber-400 font-bold' : 'text-cyan-400'}>
                                      {telem.utilizationDownPercent}%
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        telem.utilizationDownPercent > 85 ? 'bg-rose-500' : telem.utilizationDownPercent > 70 ? 'bg-amber-400' : 'bg-cyan-400'
                                      }`}
                                      style={{ width: `${Math.min(100, telem.utilizationDownPercent)}%` }}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-slate-400 mb-0.5">
                                    <span>Uplink: <strong className="text-white">{telem.deliveredUpMbps} Mbps</strong> / {circ.uploadBandwidth}M</span>
                                    <span className="text-blue-400">{telem.utilizationUpPercent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-blue-400 transition-all duration-300"
                                      style={{ width: `${Math.min(100, telem.utilizationUpPercent)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Jitter, Latency, Loss */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                                <span>Lat: <strong className="text-slate-200">{telem.latencyMs}ms</strong></span>
                                <span>Jitter: <strong className="text-slate-200">{telem.jitterMs}ms</strong></span>
                                <span>Loss: <strong className={telem.packetLossPercent > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{telem.packetLossPercent}%</strong></span>
                                <span>CIR: <strong className="text-amber-300">{telem.cirUtilizationDownPercent}%</strong></span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between">
                        {!isPrimary ? (
                          <button
                            onClick={() => setPrimaryCircuit(circ.id)}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          >
                            <Star className="w-3 h-3" />
                            <span>Set as Primary WAN</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-amber-400" />
                            <span>Active Primary Route</span>
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => duplicateCircuit(circ.id)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            title="Duplicate Circuit"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingCircuit(circ);
                              setIsCircuitModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 transition-colors"
                            title="Edit Circuit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setCircuitToDelete(circ)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                            title="Delete Circuit"
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
          </div>
        )}

        {/* SUBTAB 2: PROVIDERS LIST */}
        {subTab === 'providers' && (
          <div className="space-y-3">
            {filteredProviders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-300">No ISP Providers Registered</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Add internet service providers (Telkom, Biznet, Indosat, Starlink) to begin provisioning leased lines.
                </p>
                <button
                  onClick={() => {
                    setEditingProvider(null);
                    setIsProviderModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register First Provider</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredProviders.map((prov) => {
                  const circuitCount = circuits.filter((c) => c.ispProviderId === prov.id).length;

                  return (
                    <div
                      key={prov.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
                    >
                      <div>
                        {/* Provider Header */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 className="text-sm font-bold text-white">{prov.name}</h4>
                            <span className="text-[10px] text-cyan-400 font-mono uppercase font-bold tracking-wider">
                              {prov.type}
                            </span>
                          </div>

                          <button
                            onClick={() => toggleIspProviderStatus(prov.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase transition-colors ${
                              prov.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {prov.status}
                          </button>
                        </div>

                        {/* Description */}
                        {prov.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 mb-3">
                            {prov.description}
                          </p>
                        )}

                        {/* Metadata pills */}
                        <div className="space-y-1.5 py-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[10px]">Active Circuits:</span>
                            <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                              {circuitCount} circuit(s)
                            </span>
                          </div>

                          {prov.customerService && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-400" />
                                <span>Support / NOC:</span>
                              </span>
                              <span className="font-mono text-slate-300">{prov.customerService}</span>
                            </div>
                          )}

                          {prov.website && (
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 flex items-center gap-1">
                                <Globe className="w-3 h-3 text-cyan-400" />
                                <span>Portal:</span>
                              </span>
                              <a
                                href={prov.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline flex items-center gap-0.5 font-mono"
                              >
                                <span>Visit</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Provider Actions */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setEditingCircuit({
                              id: '',
                              ispProviderId: prov.id,
                              circuitName: `${prov.name} Circuit`,
                              serviceType: 'dedicated',
                              downloadBandwidth: 100,
                              downloadUnit: 'Mbps',
                              uploadBandwidth: 100,
                              uploadUnit: 'Mbps',
                              contentionRatio: '1:1',
                              isPrimaryWan: false,
                              status: 'active',
                              createdAt: '',
                              updatedAt: '',
                            });
                            setIsCircuitModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Circuit</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => duplicateIspProvider(prov.id)}
                            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                            title="Duplicate Provider"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingProvider(prov);
                              setIsProviderModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 transition-colors"
                            title="Edit Provider"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setProviderToDelete(prov)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                            title="Delete Provider"
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
          </div>
        )}
      </div>

      {/* Delete Error Modal */}
      {deleteError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-rose-500/50 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-sm">Cannot Delete ISP Provider</h4>
            </div>
            <p className="text-xs text-slate-300 mb-4">{deleteError}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setDeleteError(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Circuit Confirmation Modal */}
      {circuitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h4 className="font-bold text-sm text-white mb-2">Delete Internet Circuit?</h4>
            <p className="text-xs text-slate-300 mb-4">
              Are you sure you want to remove circuit <strong>{circuitToDelete.circuitName}</strong>? Any associated WAN routing policies will be decommissioned.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCircuitToDelete(null)}
                className="px-3.5 py-1.5 text-slate-400 hover:text-white rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCircuit(circuitToDelete.id);
                  setCircuitToDelete(null);
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Delete Circuit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Provider Confirmation Modal */}
      {providerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <h4 className="font-bold text-sm text-white mb-2">Delete ISP Provider?</h4>
            <p className="text-xs text-slate-300 mb-4">
              Remove ISP company <strong>{providerToDelete.name}</strong> from catalog?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setProviderToDelete(null)}
                className="px-3.5 py-1.5 text-slate-400 hover:text-white rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProvider(providerToDelete.id)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold"
              >
                Delete Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Modal Form */}
      <IspProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => {
          setIsProviderModalOpen(false);
          setEditingProvider(null);
        }}
        onSave={handleSaveProvider}
        initialData={editingProvider}
      />

      {/* Circuit Modal Form */}
      <InternetCircuitModal
        isOpen={isCircuitModalOpen}
        onClose={() => {
          setIsCircuitModalOpen(false);
          setEditingCircuit(null);
        }}
        onSave={handleSaveCircuit}
        providers={providers}
        initialData={editingCircuit}
      />

      {/* CPE & Router WAN Interface Mapping Modal */}
      <CpeWanMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => {
          setIsMappingModalOpen(false);
          setMappingCircuit(null);
        }}
        circuit={mappingCircuit}
      />
    </div>
  );
};
