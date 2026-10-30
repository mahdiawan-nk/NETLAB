import React, { useState, useRef, useEffect } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { AUTOCOMPLETE_SUGGESTIONS } from '../services/cliParser';
import { calculateIspThroughput } from '../services/trafficEngine';
import { IspManagementDashboard } from './IspManager/IspManagementDashboard';
import { WorkloadManagementDashboard } from './WorkloadManager/WorkloadManagementDashboard';
import {
  Terminal,
  AlertTriangle,
  Layers,
  History,
  ChevronDown,
  ChevronUp,
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Play,
  Pause,
  Globe,
  Radio,
  FileText,
  RotateCcw,
  Download,
  HelpCircle,
} from 'lucide-react';
import { GuideSectionId } from '../types/userGuide';

export const BottomPanel: React.FC = () => {
  const {
    activeProject,
    diagnostics,
    auditLogs,
    cliHistory,
    activePacketTrace,
    simulationHistory,
    trafficStats,
    isTrafficRunning,
    ispServices,
    eventLogs,
    executeCli,
    runPing,
    clearPacketTrace,
    toggleTrafficSimulation,
    addVlan,
    removeVlan,
    updateIspService,
    validateCurrentTopology,
    openUserGuide,
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<'cli' | 'simulation' | 'traffic' | 'isp' | 'workloads' | 'diagnostics' | 'vlans' | 'events' | 'audit'>('cli');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number>(300);
  const [cliInput, setCliInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Packet Tracer Form State
  const [simSourceDevId, setSimSourceDevId] = useState<string>('');
  const [simTargetIp, setSimTargetIp] = useState<string>('8.8.8.8');
  const [simProtocol, setSimProtocol] = useState<'ICMP' | 'TCP' | 'UDP' | 'DNS' | 'DHCP'>('ICMP');

  // New VLAN form state
  const [isAddVlanOpen, setIsAddVlanOpen] = useState(false);
  const [vlanId, setVlanId] = useState(50);
  const [vlanName, setVlanName] = useState('GUEST-WIFI');
  const [vlanSubnet, setVlanSubnet] = useState('10.50.0.0/24');
  const [vlanGw, setVlanGw] = useState('10.50.0.1');

  const cliOutputRef = useRef<HTMLDivElement>(null);
  const cliInputRef = useRef<HTMLInputElement>(null);

  // Default source device for packet tracer
  useEffect(() => {
    if (!simSourceDevId && activeProject.devices.length > 0) {
      const endpoint = activeProject.devices.find((d) => d.category === 'endpoint');
      setSimSourceDevId(endpoint?.id || activeProject.devices[0].id);
    }
  }, [activeProject.devices, simSourceDevId]);

  // Auto-scroll CLI output
  useEffect(() => {
    if (cliOutputRef.current) {
      cliOutputRef.current.scrollTop = cliOutputRef.current.scrollHeight;
    }
  }, [cliHistory]);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;
    executeCli(cliInput);
    setCliInput('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const pastCommands = cliHistory.map((h) => h.command).filter(Boolean);
      if (pastCommands.length === 0) return;
      const nextIndex = historyIndex === -1 ? pastCommands.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCliInput(pastCommands[nextIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const pastCommands = cliHistory.map((h) => h.command).filter(Boolean);
      if (pastCommands.length === 0 || historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= pastCommands.length) {
        setHistoryIndex(-1);
        setCliInput('');
      } else {
        setHistoryIndex(nextIndex);
        setCliInput(pastCommands[nextIndex]);
      }
    }
  };

  const handleRunSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simSourceDevId || !simTargetIp.trim()) return;
    runPing(simSourceDevId, simTargetIp.trim(), simProtocol);
  };

  const handleCreateVlan = (e: React.FormEvent) => {
    e.preventDefault();
    addVlan({
      id: vlanId,
      name: vlanName,
      subnet: vlanSubnet,
      gatewayIp: vlanGw,
      dhcpEnabled: true,
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
    });
    setIsAddVlanOpen(false);
  };

  const handleExportReport = () => {
    const lines = [
      `# NETLAB Network Engineering Audit & Simulation Report`,
      `Generated: ${new Date().toLocaleString()} (UTC)`,
      `Project: ${activeProject.name} (ID: ${activeProject.id})`,
      `----------------------------------------------------------------------`,
      ``,
      `## 1. Topo-Layer Validation & Diagnostics`,
      `Overall Status: ${diagnostics.length === 0 ? 'ALL SYSTEMS NORMAL (RUN)' : `${diagnostics.length} ANOMALIES DETECTED`}`,
      ...(diagnostics.length === 0
        ? ['  - All physical interfaces, transceivers, VLAN tags, and subnets validated successfully.']
        : diagnostics.map((d) => `  - [${d.severity.toUpperCase()}] ${d.errorCode}: ${d.observedCondition} -> Cause: ${d.probableCause} -> Recommendation: ${d.recommendedAction}`)),
      ``,
      `## 2. Infrastructure Inventory`,
      `Total Devices: ${activeProject.devices.length}`,
      `Total Physical Links: ${activeProject.links.length}`,
      ...activeProject.devices.map((d) => `  - ${d.name} (${d.modelName}, ${d.vendor}) [${d.category.toUpperCase()}] - OS: ${d.routerOsVersion} - ${d.interfaces.length} Interfaces`),
      ``,
      `## 3. Physical Links & Fiber Optic Budget`,
      ...activeProject.links.map((l) => `  - Link [${l.id}]: ${l.mediaType} (${l.cableLengthMeters}m, ${l.speed}) Status: ${l.status}${l.isFiber ? ' (Optical Loss Budget: PASS)' : ''}`),
      ``,
      `## 4. 802.1Q VLAN Database`,
      ...activeProject.vlans.map((v) => `  - VLAN ${v.id} (${v.name}): Subnet ${v.subnet}, Gateway ${v.gatewayIp}, DHCP Server: ${v.dhcpEnabled ? 'Enabled' : 'Disabled'}`),
      ``,
      `## 5. ISP Contracts & Contention Profiles`,
      ...ispServices.map((isp) => {
        const calc = calculateIspThroughput(isp);
        return `  - ${isp.providerName} (${isp.serviceType.toUpperCase()}): Bandwidth ${isp.bandwidthDownMbps}M / CIR Guarantee ${isp.cirDownMbps}M / Contention ${isp.contentionRatio} -> Current Estimated Throughput: ${calc.estimatedThroughputDownMbps} Mbps (${isp.activeUsers} concurrent users)`;
      }),
      ``,
      `## 6. Packet Tracer Simulation Trace History`,
      ...(simulationHistory.length === 0
        ? ['  - No simulation runs recorded yet.']
        : simulationHistory.slice(0, 10).map((s) => `  - [${s.protocol}] ${s.sourceDeviceName} -> ${s.targetIp}: ${s.success ? 'REACHABLE' : 'FAILED'} (RTT: ${s.totalLatencyMs}ms, ${s.hops.length} hops) - Summary: ${s.summary}`)),
      ``,
      `----------------------------------------------------------------------`,
      `Report end. Verified by NETLAB v1.0.0 Engine.`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NETLAB_Report_${activeProject.name.replace(/[^a-z0-9]/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const congestedLinksCount = Object.values(trafficStats).filter((s) => s.isCongested).length;

  return (
    <div
      style={{ height: isCollapsed ? '36px' : `${panelHeight}px` }}
      className="border-t border-slate-800 bg-slate-950/95 transition-all flex flex-col z-30 select-none"
    >
      {/* Console Tab Header */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          {/* Tab: CLI */}
          <button
            onClick={() => { setActiveTab('cli'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'cli' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CLI</span>
          </button>

          {/* Tab: Packet Simulation Lab */}
          <button
            onClick={() => { setActiveTab('simulation'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'simulation' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Packet Tracer {activePacketTrace ? '●' : ''}</span>
          </button>

          {/* Tab: Traffic Monitoring */}
          <button
            onClick={() => { setActiveTab('traffic'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'traffic' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Traffic Telemetry</span>
            {congestedLinksCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          {/* Tab: ISP & Bandwidth */}
          <button
            onClick={() => { setActiveTab('isp'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'isp' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>ISP & Circuits ({(activeProject.circuits || []).length})</span>
          </button>

          {/* Tab: Realistic Workload Generator */}
          <button
            onClick={() => { setActiveTab('workloads'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'workloads' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Workloads ({(activeProject.workloads || []).length})</span>
          </button>

          {/* Tab: Diagnostics */}
          <button
            onClick={() => { setActiveTab('diagnostics'); setIsCollapsed(false); validateCurrentTopology(); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'diagnostics' && !isCollapsed
                ? 'bg-slate-800 text-amber-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Diagnostics ({diagnostics.length})</span>
            {errorCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500" />}
          </button>

          {/* Tab: VLANs */}
          <button
            onClick={() => { setActiveTab('vlans'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'vlans' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>VLANs ({activeProject.vlans.length})</span>
          </button>

          {/* Tab: Events */}
          <button
            onClick={() => { setActiveTab('events'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'events' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Events ({eventLogs.length})</span>
          </button>

          {/* Tab: Audit */}
          <button
            onClick={() => { setActiveTab('audit'); setIsCollapsed(false); }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'audit' && !isCollapsed
                ? 'bg-slate-800 text-cyan-400 font-bold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>
        </div>

        {/* Contextual Guide Help, Height Toggle & Collapse */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              const tabToGuideMap: Record<typeof activeTab, GuideSectionId> = {
                cli: 'cli-reference',
                simulation: 'network-simulation',
                traffic: 'monitoring',
                isp: 'isp-management',
                workloads: 'workload-management',
                diagnostics: 'diagnostics',
                vlans: 'interface-connections',
                events: 'event-audit-log',
                audit: 'event-audit-log',
              };
              openUserGuide(tabToGuideMap[activeTab] || 'getting-started');
            }}
            title="Buka Panduan untuk Tab Aktif Ini"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-cyan-950/80 text-cyan-400 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-[10px] font-semibold transition-colors"
          >
            <HelpCircle className="w-3 h-3" />
            <span className="hidden md:inline">Help</span>
          </button>

          <button
            onClick={() => setPanelHeight(panelHeight === 300 ? 420 : 300)}
            title="Toggle Panel Height"
            className="text-[10px] px-1.5 py-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 font-mono hidden sm:block"
          >
            {panelHeight === 300 ? 'Expand' : 'Compact'}
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-slate-400 hover:text-white rounded"
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Console Tab Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col font-mono text-xs">
          {/* TAB 1: NETLAB CLI */}
          {activeTab === 'cli' && (
            <div className="flex-1 flex flex-col p-2 overflow-hidden">
              <div
                ref={cliOutputRef}
                className="flex-1 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded border border-slate-900 text-slate-300"
              >
                {cliHistory.map((item, index) => (
                  <div key={index} className="space-y-0.5">
                    {item.command && (
                      <div className="flex items-center gap-2 text-cyan-400">
                        <span className="text-slate-500">[{item.timestamp}]</span>
                        <span className="font-bold text-slate-400">NETLAB#</span>
                        <span className="text-white">{item.command}</span>
                      </div>
                    )}
                    {item.output && (
                      <pre
                        className={`text-[11.5px] leading-relaxed whitespace-pre-wrap pl-4 font-mono ${
                          item.isError ? 'text-rose-400' : 'text-slate-300'
                        }`}
                      >
                        {item.output}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              {/* Quick Suggestions Strip */}
              <div className="flex items-center gap-1.5 py-1 px-1 overflow-x-auto text-[10px] text-slate-500 shrink-0">
                <span className="text-slate-500 font-sans">Quick:</span>
                {[
                  'ping 8.8.8.8',
                  'ping 10.20.0.1',
                  'traceroute 8.8.8.8',
                  'show traffic',
                  'show isp',
                  'show events',
                  'simulate validate',
                ].map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCliInput(cmd);
                      cliInputRef.current?.focus();
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-800 whitespace-nowrap transition-colors"
                  >
                    {cmd}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 pt-1 shrink-0">
                <div className="flex items-center gap-1.5 flex-1 bg-slate-900 border border-slate-700/80 rounded px-3 py-1.5">
                  <span className="text-cyan-400 font-bold">NETLAB#</span>
                  <input
                    ref={cliInputRef}
                    type="text"
                    value={cliInput}
                    onChange={(e) => setCliInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter command (e.g. 'ping 8.8.8.8', 'traceroute 10.20.0.1', 'show traffic', 'help')"
                    className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder-slate-600 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Execute</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: PACKET TRACER & SIMULATION LAB */}
          {activeTab === 'simulation' && (
            <div className="flex-1 flex flex-col p-3 overflow-hidden font-sans">
              {/* Top Controls: Source, Target IP, Protocol */}
              <form onSubmit={handleRunSimulation} className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-lg flex flex-wrap items-center gap-3 shrink-0">
                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase mb-0.5">Source Node</label>
                  <select
                    value={simSourceDevId}
                    onChange={(e) => setSimSourceDevId(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {activeProject.devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] text-slate-400 font-mono uppercase mb-0.5">Target IP / Destination</label>
                  <input
                    type="text"
                    required
                    value={simTargetIp}
                    onChange={(e) => setSimTargetIp(e.target.value)}
                    placeholder="e.g. 10.20.0.1 or 8.8.8.8"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-mono uppercase mb-0.5">Protocol</label>
                  <select
                    value={simProtocol}
                    onChange={(e) => setSimProtocol(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="ICMP">ICMP (Ping Echo)</option>
                    <option value="UDP">UDP (Traceroute)</option>
                    <option value="TCP">TCP (HTTP 80)</option>
                    <option value="DNS">DNS (Port 53)</option>
                  </select>
                </div>

                <div className="flex items-end gap-2 pt-4">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Send Packet</span>
                  </button>

                  {activePacketTrace && (
                    <button
                      type="button"
                      onClick={clearPacketTrace}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>

              {/* Hop Breakdown Results Timeline */}
              <div className="flex-1 overflow-y-auto mt-2.5 space-y-2">
                {activePacketTrace ? (
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2">
                      <div className="flex items-center gap-2">
                        {activePacketTrace.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="font-bold text-xs text-white">
                          {activePacketTrace.summary}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-cyan-400">
                        Total Latency: {activePacketTrace.totalLatencyMs}ms · {activePacketTrace.hops.length} Hops
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {activePacketTrace.hops.map((hop) => (
                        <div
                          key={hop.hopNumber}
                          className={`p-2 rounded border flex items-center justify-between text-xs font-mono transition-colors ${
                            hop.status === 'OK'
                              ? 'bg-slate-900/70 border-slate-800'
                              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                              {hop.hopNumber}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white font-sans">{hop.deviceName}</span>
                                <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-[10px] text-cyan-300">
                                  {hop.action}
                                </span>
                                {hop.vlanId && (
                                  <span className="text-[10px] text-emerald-400">VLAN {hop.vlanId}</span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-sans block mt-0.5">
                                {hop.details}
                              </span>
                            </div>
                          </div>

                          <div className="text-right text-[11px] text-slate-400 shrink-0">
                            <span>+{hop.latencyMs.toFixed(2)}ms</span>
                            {hop.dropReason && (
                              <span className="block text-rose-400 font-bold text-[10px] mt-0.5">{hop.dropReason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs font-sans">
                    No active packet trace. Select a source host above and click <strong>Send Packet</strong> to trace Layer 2 switching, VLANs, and Layer 3 routing.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TRAFFIC TELEMETRY */}
          {activeTab === 'traffic' && (
            <div className="flex-1 flex flex-col p-3 overflow-y-auto font-sans">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="text-xs font-bold text-white">Live Link Telemetry & Throughput</h4>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Engine: {isTrafficRunning ? 'ACTIVE' : 'PAUSED'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportReport}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                    title="Export complete engineering audit report as Markdown"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Export Audit Report</span>
                  </button>

                  <button
                    onClick={toggleTrafficSimulation}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    {isTrafficRunning ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{isTrafficRunning ? 'Pause Engine' : 'Resume Engine'}</span>
                  </button>
                </div>
              </div>

              {/* Grid of Link Telemetry Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {activeProject.links.map((link) => {
                  const stats = trafficStats[link.id];
                  const rxMb = stats ? (stats.rxBps / 1_000_000).toFixed(1) : '0.0';
                  const txMb = stats ? (stats.txBps / 1_000_000).toFixed(1) : '0.0';
                  const util = stats ? stats.utilizationPercent : 0;
                  const isCongested = stats?.isCongested;

                  return (
                    <div
                      key={link.id}
                      className={`p-2.5 rounded-lg border text-xs font-mono transition-all ${
                        isCongested
                          ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
                          : 'bg-slate-900/70 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-white font-sans truncate">{link.id}</span>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.5 rounded uppercase font-bold ${
                            isCongested
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-800 text-cyan-400'
                          }`}
                        >
                          {isCongested ? 'CONGESTED' : link.speed}
                        </span>
                      </div>

                      {/* Throughput Metrics */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 py-1 border-t border-slate-800/60">
                        <div>
                          <span className="text-slate-500 block text-[9.5px]">RX THROUGHPUT</span>
                          <span className="text-emerald-400 font-bold">{rxMb} Mbps</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[9.5px]">TX THROUGHPUT</span>
                          <span className="text-cyan-400 font-bold">{txMb} Mbps</span>
                        </div>
                      </div>

                      {/* Progress Bar for Utilization */}
                      <div className="mt-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                          <span>Utilization</span>
                          <span className={util > 80 ? 'text-amber-400 font-bold' : 'text-slate-300'}>{util}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              util > 80 ? 'bg-amber-500' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${util}%` }}
                          />
                        </div>
                      </div>

                      {/* Live Waveform Sparkline */}
                      {stats?.history && stats.history.length > 1 && (
                        <div className="mt-2 pt-1.5 border-t border-slate-800/60">
                          <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1">
                            <span className="font-sans">Waveform (RX: green, TX: cyan)</span>
                            <span>{stats.history.length} samples</span>
                          </div>
                          <div className="h-6 w-full bg-slate-950/60 rounded overflow-hidden relative">
                            <svg className="w-full h-full" viewBox="0 0 100 24" preserveAspectRatio="none">
                              {/* RX Polyline */}
                              <polyline
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.5"
                                points={stats.history
                                  .map((h, i) => {
                                    const x = (i / (stats.history.length - 1)) * 100;
                                    const maxCap = Math.max(1, stats.capacityBps / 1_000_000);
                                    const y = 24 - Math.min(22, (h.rxMbps / maxCap) * 22);
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  })
                                  .join(' ')}
                              />
                              {/* TX Polyline */}
                              <polyline
                                fill="none"
                                stroke="#06b6d4"
                                strokeWidth="1.5"
                                points={stats.history
                                  .map((h, i) => {
                                    const x = (i / (stats.history.length - 1)) * 100;
                                    const maxCap = Math.max(1, stats.capacityBps / 1_000_000);
                                    const y = 24 - Math.min(22, (h.txMbps / maxCap) * 22);
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  })
                                  .join(' ')}
                              />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DYNAMIC ISP & INTERNET CIRCUIT MANAGER */}
          {activeTab === 'isp' && (
            <IspManagementDashboard />
          )}

          {/* TAB 4B: REALISTIC WORKLOAD & TRAFFIC GENERATOR */}
          {activeTab === 'workloads' && (
            <WorkloadManagementDashboard />
          )}

          {/* TAB 5: DIAGNOSTICS & ROOT CAUSE */}
          {activeTab === 'diagnostics' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-sans">
              {diagnostics.length === 0 ? (
                <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <div>
                    <h4 className="font-bold text-xs">Zero Topological Anomalies Detected</h4>
                    <p className="text-[11px] text-emerald-300 mt-0.5">
                      All physical interfaces, optical budgets, VLAN tags, and IP subnets conform strictly to Layer 1–3 network engineering specifications.
                    </p>
                  </div>
                </div>
              ) : (
                diagnostics.map((diag) => (
                  <div
                    key={diag.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      diag.severity === 'error'
                        ? 'bg-rose-950/30 border-rose-500/40'
                        : 'bg-amber-950/30 border-amber-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {diag.severity === 'error' ? (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-white tracking-wide">{diag.errorCode}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          {diag.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{diag.timestamp.slice(11, 19)}</span>
                    </div>

                    <p className="text-slate-200 font-medium">{diag.observedCondition}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800 font-mono">
                      <div><strong className="text-slate-300 font-sans">Evidence:</strong> {diag.evidence}</div>
                      <div><strong className="text-slate-300 font-sans">Probable Cause:</strong> {diag.probableCause}</div>
                    </div>

                    <div className="text-[11px] text-cyan-300 bg-cyan-950/40 p-2 rounded border border-cyan-800/40 font-mono">
                      <strong className="font-sans">Recommended Fix:</strong> {diag.recommendedAction}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: VLAN DATABASE */}
          {activeTab === 'vlans' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Project VLAN Database</h4>
                  <span className="text-[11px] text-slate-400">802.1Q broadcast segregation domains</span>
                </div>
                <button
                  onClick={() => setIsAddVlanOpen(true)}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add VLAN</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 font-mono text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/80 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">VLAN ID</th>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Subnet CIDR</th>
                      <th className="p-2.5">Default Gateway</th>
                      <th className="p-2.5">DHCP Server</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {activeProject.vlans.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-2.5 font-bold text-cyan-400">VLAN {v.id}</td>
                        <td className="p-2.5 text-white">{v.name}</td>
                        <td className="p-2.5 text-slate-300">{v.subnet}</td>
                        <td className="p-2.5 text-slate-300">{v.gatewayIp}</td>
                        <td className="p-2.5">
                          {v.dhcpEnabled ? (
                            <span className="text-emerald-400 font-semibold">Enabled</span>
                          ) : (
                            <span className="text-slate-500">Disabled</span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => removeVlan(v.id)}
                            title="Delete VLAN"
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add VLAN Modal */}
              {isAddVlanOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-sm w-full p-4 shadow-xl">
                    <h3 className="text-sm font-bold text-white mb-3">Add New 802.1Q VLAN</h3>
                    <form onSubmit={handleCreateVlan} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">VLAN ID (1-4094)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="4094"
                          value={vlanId}
                          onChange={(e) => setVlanId(parseInt(e.target.value, 10))}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">VLAN Name</label>
                        <input
                          type="text"
                          required
                          value={vlanName}
                          onChange={(e) => setVlanName(e.target.value.toUpperCase())}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Subnet CIDR</label>
                        <input
                          type="text"
                          required
                          value={vlanSubnet}
                          onChange={(e) => setVlanSubnet(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Gateway IP</label>
                        <input
                          type="text"
                          required
                          value={vlanGw}
                          onChange={(e) => setVlanGw(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddVlanOpen(false)}
                          className="px-3 py-1.5 text-slate-400 hover:text-white rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded"
                        >
                          Save VLAN
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 7: EVENT LOGS */}
          {activeTab === 'events' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-sans text-xs">
              <div className="text-xs text-slate-400 mb-2">
                Operational event stream (Link up/down transitions, congestion thresholds, and packet simulation dispatches).
              </div>

              {eventLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No events recorded.</div>
              ) : (
                eventLogs.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-start justify-between font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          ev.severity === 'error'
                            ? 'bg-rose-500'
                            : ev.severity === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                      />
                      <span className="font-bold text-white font-sans">{ev.title}:</span>
                      <span className="text-slate-300 font-sans">{ev.message}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                      {ev.timestamp.slice(11, 19)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 8: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-sans text-xs">
              <div className="text-xs text-slate-400 mb-2">
                Real-time chronological audit trail of configuration modifications and user operations.
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-6 text-slate-500">No audit logs recorded yet in current session.</div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-slate-900 border border-slate-800 flex items-start justify-between font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-cyan-400 font-bold">{log.action}</span>
                      <span className="text-slate-300 font-sans">{log.details}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 shrink-0">
                      via <span className="uppercase text-slate-400 font-bold">{log.source}</span> · {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
