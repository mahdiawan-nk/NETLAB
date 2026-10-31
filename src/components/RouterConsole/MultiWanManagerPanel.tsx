import React, { useMemo, useState } from 'react';
import { NetworkDevice, NetworkProject } from '../../types/network';
import {
  HybridPolicyRule,
  LoadBalancingMethod,
  MultiWanConfigState,
  MultiWanInterfaceConfig,
  MultiWanSimulationScenarioId,
  MultiWanTemplateType,
  RouterOsDeviceConfig,
  WanConnectionType,
  WanHealthCheckMethod,
  WanOperationalState,
  WanRole,
} from '../../types/routerOs';
import { MutationResult, RouterOsConfigService } from '../../services/routerOsConfigService';
import {
  applyMultiWanToDevice,
  applySimulationScenarioToMultiWan,
  buildMergedConfigWithMultiWan,
  buildWanEntry,
  calculateMultiWanTelemetry,
  calculateWeightedPccRatios,
  createMultiWanSnapshot,
  ensureMultiWanState,
  generateMultiWanObjects,
  getAvailablePhysicalInterfaces,
  MULTIWAN_SIMULATION_SCENARIOS,
  previewMultiWanDryRun,
  rollbackMultiWanSnapshot,
  SAMPLE_MULTIWAN_TEMPLATES,
  validateMultiWanConfig,
} from '../../services/multiWanService';
import { simulatePacketTrace } from '../../services/simulationEngine';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCode,
  GitBranch,
  Globe,
  History,
  Layers,
  Network,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

interface MultiWanManagerPanelProps {
  device: NetworkDevice;
  project: NetworkProject;
  mutateConfig: (
    actionName: string,
    mutationFn: (dev: NetworkDevice, cfg: RouterOsDeviceConfig) => MutationResult
  ) => MutationResult;
}

type ManagerWorkspaceTab =
  | 'wizard'
  | 'templates'
  | 'monitoring'
  | 'validation-diff'
  | 'cli-preview'
  | 'snapshots';

const STATUS_BADGE_STYLES: Record<WanOperationalState, string> = {
  UP: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/70',
  DOWN: 'bg-rose-950/90 text-rose-300 border-rose-700/70',
  DEGRADED: 'bg-amber-950/90 text-amber-300 border-amber-700/70',
  RECOVERING: 'bg-cyan-950/90 text-cyan-300 border-cyan-700/70',
};

export const MultiWanManagerPanel: React.FC<MultiWanManagerPanelProps> = ({
  device,
  project,
  mutateConfig,
}) => {
  const config = RouterOsConfigService.ensureConfig(device);
  const initialMwan = useMemo(() => ensureMultiWanState(device, project), [device, project]);

  const [mwan, setMwan] = useState<MultiWanConfigState>(initialMwan);
  const [activeSubTab, setActiveSubTab] = useState<ManagerWorkspaceTab>('wizard');
  const [cliPreviewVersion, setCliPreviewVersion] = useState<'v6' | 'v7'>(config.version);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);
  const [snapshotNameInput, setSnapshotNameInput] = useState('');

  // Simulation Packet Test states
  const [simTestTargetIp, setSimTestTargetIp] = useState('8.8.8.8');
  const [simTestProtocol, setSimTestProtocol] = useState<'ICMP' | 'TCP' | 'UDP'>('TCP');
  const [simTestDstPort, setSimTestDstPort] = useState<number>(443);
  const [simTestResultText, setSimTestResultText] = useState<string[]>([]);

  const physicalInterfaces = useMemo(
    () => getAvailablePhysicalInterfaces(device),
    [device]
  );

  const ispProviderSuggestions = useMemo(() => {
    const dynamicNames = (project.ispProviders || []).map((p) => p.name);
    const serviceNames = (project.ispServices || []).map((s) => s.providerName);
    const defaults = [
      'Biznet Dedicated Fiber',
      'IndiHome Broadband Pro',
      'FirstMedia Corporate',
      'Telkomsel Enterprise Metro-E',
      'Starlink Business LEO',
      'CBN Fiber Pro',
      'MyRepublic Business',
    ];
    return Array.from(new Set([...dynamicNames, ...serviceNames, ...defaults]));
  }, [project.ispProviders, project.ispServices]);

  // Derived Telemetry, Validation, Dry-Run, and Generated Artifacts
  const telemetry = useMemo(() => calculateMultiWanTelemetry(mwan), [mwan]);
  const validationIssues = useMemo(() => validateMultiWanConfig(device, mwan), [device, mwan]);
  const dryRunPreview = useMemo(() => previewMultiWanDryRun(device, mwan), [device, mwan]);
  const generatedForPreview = useMemo(
    () => generateMultiWanObjects(device, mwan, cliPreviewVersion),
    [device, mwan, cliPreviewVersion]
  );
  const weightedCalc = useMemo(
    () => calculateWeightedPccRatios(mwan.wans, mwan.useAutoBandwidthWeight),
    [mwan.wans, mwan.useAutoBandwidthWeight]
  );

  // Sync draft Multi-WAN state into device.routerOsConfig without overwriting routing tables until Apply,
  // or apply full generated config when user clicks Apply / runs Simulation Scenario
  const persistMultiWanDraft = (nextMwan: MultiWanConfigState, actionLabel: string) => {
    setMwan(nextMwan);
    mutateConfig(actionLabel, (_dev, cfg) => ({
      success: true,
      config: {
        ...cfg,
        multiWanConfig: nextMwan,
        lastModifiedAt: new Date().toISOString(),
      },
    }));
  };

  // ==========================================
  // HANDLERS: TEMPLATES & PRESETS
  // ==========================================

  const handleSelectCoreTemplate = (template: MultiWanTemplateType) => {
    const next: MultiWanConfigState = {
      ...mwan,
      activeTemplate: template,
    };
    persistMultiWanDraft(next, `Multi-WAN: Select ${template} mode`);
  };

  const handleLoadSamplePreset = (presetId: string, andApply = false) => {
    const preset = SAMPLE_MULTIWAN_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;
    const built = preset.buildState(device);
    setMwan(built);

    if (andApply) {
      const res = mutateConfig(`Apply Multi-WAN Preset: ${preset.title}`, (dev) =>
        applyMultiWanToDevice(dev, built)
      );
      if (res.success) {
        setBannerMessage({
          type: 'success',
          text: `Template "${preset.title}" berhasil dimuat dan diterapkan ke ${device.name}!`,
        });
      } else {
        setBannerMessage({
          type: 'error',
          text: res.error || 'Gagal menerapkan template.',
        });
      }
    } else {
      persistMultiWanDraft(built, `Load Multi-WAN Template: ${preset.title}`);
      setBannerMessage({
        type: 'info',
        text: `Template "${preset.title}" dimuat ke Wizard. Anda dapat melakukan kustomisasi atau klik "Apply to Virtual Router".`,
      });
    }
  };

  const handleResetWizard = () => {
    const defaultPreset = SAMPLE_MULTIWAN_TEMPLATES[0];
    const resetState = defaultPreset.buildState(device);
    persistMultiWanDraft(resetState, 'Reset Multi-WAN Wizard to Default');
    setBannerMessage({
      type: 'info',
      text: 'Konfigurasi Multi-WAN Wizard telah di-reset ke pengaturan awal.',
    });
  };

  // ==========================================
  // HANDLERS: DYNAMIC WAN CRUD
  // ==========================================

  const handleAddWan = () => {
    const nextIdx = mwan.wans.length;
    const usedIfaces = new Set(mwan.wans.map((w) => w.physicalInterface));
    const unusedIface =
      physicalInterfaces.find((i) => !usedIfaces.has(i)) ||
      physicalInterfaces[nextIdx % physicalInterfaces.length] ||
      `ether${nextIdx + 1}`;

    const newWan = buildWanEntry(nextIdx, unusedIface, {
      id: `wan-${Date.now()}`,
      name: `WAN${nextIdx + 1}`,
      priority: nextIdx + 1,
      distance: nextIdx + 1,
      role: nextIdx === 0 ? 'primary' : nextIdx === 1 ? 'secondary' : 'backup',
      healthCheckTarget:
        nextIdx === 0
          ? '8.8.8.8'
          : nextIdx === 1
          ? '1.1.1.1'
          : nextIdx === 2
          ? '9.9.9.9'
          : `208.67.222.${220 + nextIdx}`,
    });

    const next: MultiWanConfigState = {
      ...mwan,
      wans: [...mwan.wans, newWan],
    };
    persistMultiWanDraft(next, `Add ${newWan.name} (${unusedIface})`);
  };

  const handleRemoveWan = (wanId: string) => {
    if (mwan.wans.length <= 2) {
      setBannerMessage({
        type: 'error',
        text: 'Konfigurasi Multi-WAN memerlukan minimal 2 jalur WAN.',
      });
      return;
    }
    const filtered = mwan.wans
      .filter((w) => w.id !== wanId)
      .map((w, idx) => ({
        ...w,
        name: `WAN${idx + 1}`,
        priority: idx + 1,
        distance: idx + 1,
      }));

    const next: MultiWanConfigState = {
      ...mwan,
      wans: filtered,
      hybridPolicies: mwan.hybridPolicies.map((pol) => ({
        ...pol,
        preferredWanIds: pol.preferredWanIds.filter((id) => id !== wanId),
        backupWanIds: pol.backupWanIds.filter((id) => id !== wanId),
      })),
    };
    persistMultiWanDraft(next, `Remove WAN (${wanId})`);
  };

  const handleUpdateWanField = <K extends keyof MultiWanInterfaceConfig>(
    wanId: string,
    field: K,
    value: MultiWanInterfaceConfig[K]
  ) => {
    const nextWans = mwan.wans.map((w) => (w.id === wanId ? { ...w, [field]: value } : w));
    persistMultiWanDraft({ ...mwan, wans: nextWans }, `Update ${field} on ${wanId}`);
  };

  // ==========================================
  // HANDLERS: HYBRID POLICIES CRUD & ORDERING
  // ==========================================

  const handleAddHybridPolicy = () => {
    const nextPrio = mwan.hybridPolicies.length + 1;
    const newPol: HybridPolicyRule = {
      id: `pol-${Date.now()}`,
      name: `Policy #${nextPrio} Custom Traffic`,
      priority: nextPrio,
      enabled: true,
      policyType: 'src-address',
      srcAddress: `10.10.${nextPrio * 10}.0/24`,
      protocol: 'all',
      routingMode: 'failover',
      pccClassifier: 'both-addresses-and-ports',
      preferredWanIds: [mwan.wans[0]?.id].filter(Boolean),
      backupWanIds: mwan.wans.slice(1).map((w) => w.id),
      comment: `Custom policy rule #${nextPrio}`,
    };
    persistMultiWanDraft(
      { ...mwan, hybridPolicies: [...mwan.hybridPolicies, newPol] },
      `Add Hybrid Policy ${newPol.name}`
    );
  };

  const handleUpdateHybridPolicy = (polId: string, patch: Partial<HybridPolicyRule>) => {
    const updated = mwan.hybridPolicies.map((p) => (p.id === polId ? { ...p, ...patch } : p));
    persistMultiWanDraft({ ...mwan, hybridPolicies: updated }, `Update Hybrid Policy ${polId}`);
  };

  const handleMoveHybridPolicy = (polId: string, dir: 'up' | 'down') => {
    const sorted = [...mwan.hybridPolicies].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((p) => p.id === polId);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;

    const temp = sorted[idx];
    sorted[idx] = sorted[targetIdx];
    sorted[targetIdx] = temp;

    const reindexed = sorted.map((p, i) => ({ ...p, priority: i + 1 }));
    persistMultiWanDraft({ ...mwan, hybridPolicies: reindexed }, `Reorder Hybrid Policy`);
  };

  const handleDeleteHybridPolicy = (polId: string) => {
    const remaining = mwan.hybridPolicies
      .filter((p) => p.id !== polId)
      .map((p, i) => ({ ...p, priority: i + 1 }));
    persistMultiWanDraft({ ...mwan, hybridPolicies: remaining }, `Delete Hybrid Policy`);
  };

  const handleToggleWanInPolicyList = (
    pol: HybridPolicyRule,
    listField: 'preferredWanIds' | 'backupWanIds',
    wanId: string
  ) => {
    const currentList = pol[listField];
    const exists = currentList.includes(wanId);
    const nextList = exists ? currentList.filter((id) => id !== wanId) : [...currentList, wanId];
    handleUpdateHybridPolicy(pol.id, { [listField]: nextList });
  };

  // ==========================================
  // HANDLERS: APPLY, SNAPSHOT, ROLLBACK & EXPORT
  // ==========================================

  const handleApplyToRouter = () => {
    const res = mutateConfig(
      `Apply Multi-WAN (${mwan.activeTemplate.toUpperCase()})`,
      (dev) => applyMultiWanToDevice(dev, mwan)
    );
    if (res.success && res.config?.multiWanConfig) {
      setMwan(res.config.multiWanConfig);
      setBannerMessage({
        type: 'success',
        text: res.message || 'Konfigurasi Multi-WAN berhasil diterapkan ke router!',
      });
    } else {
      setBannerMessage({
        type: 'error',
        text: res.error || 'Gagal menerapkan konfigurasi Multi-WAN. Periksa tab Validation.',
      });
      setActiveSubTab('validation-diff');
    }
  };

  const handleRunSimulationScenario = (scenarioId: MultiWanSimulationScenarioId) => {
    const nextMwan = applySimulationScenarioToMultiWan(mwan, scenarioId);
    setMwan(nextMwan);

    // Also synchronize route active states and Mangle rules in RouterOS config so CLI & Packet Traceroute immediately reflect the scenario
    mutateConfig(`Multi-WAN Simulation: ${scenarioId}`, (dev) => {
      const { nextConfig } = buildMergedConfigWithMultiWan(dev, nextMwan);
      return {
        success: true,
        config: nextConfig,
        message: `Simulasi skenario '${scenarioId}' aktif.`,
      };
    });
  };

  const handleExecutePacketSimulationTest = () => {
    // Ensure current Multi-WAN rules are synced before running trace
    mutateConfig('Sync Multi-WAN before Packet Test', (dev) => {
      const { nextConfig } = buildMergedConfigWithMultiWan(dev, mwan);
      return { success: true, config: nextConfig };
    });

    const trace = simulatePacketTrace(
      device.id,
      simTestTargetIp.trim() || '8.8.8.8',
      simTestProtocol,
      project,
      { dstPort: simTestDstPort, srcPort: 54120 }
    );

    const logLines: string[] = [
      `=== MULTI-WAN PACKET SIMULATION TRACE ===`,
      `Source Router : ${device.name} (RouterOS ${config.version})`,
      `Target        : ${simTestTargetIp} [${simTestProtocol}${simTestProtocol !== 'ICMP' ? `:${simTestDstPort}` : ''}]`,
      `Scenario      : ${mwan.activeScenario.toUpperCase()} | Template: ${mwan.activeTemplate.toUpperCase()}`,
      `Result        : ${trace.success ? 'DELIVERED (OK)' : 'DROPPED / UNREACHABLE'} | Total RTT: ${trace.totalLatencyMs.toFixed(2)} ms | Loss: ${trace.packetLossPercent}%`,
      `Summary       : ${trace.summary}`,
      `-----------------------------------------`,
    ];
    trace.hops.forEach((h) => {
      logLines.push(
        `Hop #${h.hopNumber} [${h.action}] ${h.deviceName} (${h.status}, ${h.latencyMs.toFixed(2)}ms): ${h.details}`
      );
    });
    setSimTestResultText(logLines);
  };

  const handleCopyCliScript = () => {
    navigator.clipboard.writeText(generatedForPreview.cliScript);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleExportRscFile = () => {
    const blob = new Blob([generatedForPreview.cliScript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.name.toLowerCase().replace(/\s+/g, '-')}-multiwan-${mwan.activeTemplate}-${cliPreviewVersion}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateSnapshot = () => {
    const res = mutateConfig('Create Multi-WAN Snapshot', (dev) =>
      createMultiWanSnapshot(dev, snapshotNameInput)
    );
    if (res.success) {
      setSnapshotNameInput('');
      setBannerMessage({
        type: 'success',
        text: res.message || 'Configuration snapshot berhasil disimpan.',
      });
    }
  };

  const handleRollbackSnapshot = (snapId: string, snapName: string) => {
    const res = mutateConfig(`Rollback Snapshot (${snapName})`, (dev) =>
      rollbackMultiWanSnapshot(dev, snapId)
    );
    if (res.success) {
      if (res.config?.multiWanConfig) {
        setMwan(res.config.multiWanConfig);
      }
      setBannerMessage({
        type: 'success',
        text: `Berhasil melakukan Rollback konfigurasi ke snapshot "${snapName}".`,
      });
    } else {
      setBannerMessage({
        type: 'error',
        text: res.error || 'Gagal melakukan rollback.',
      });
    }
  };

  const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
  const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden select-none">
      {/* Top Header & Template Mode Switcher */}
      <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <GitBranch className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                IP → MULTI-WAN CONFIGURATION MANAGER
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                RouterOS {config.version.toUpperCase()}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                  telemetry.overallStatus === 'HEALTHY'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    : telemetry.overallStatus === 'FAILOVER_ACTIVE'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                    : telemetry.overallStatus === 'DEGRADED'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                    : 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                }`}
              >
                {telemetry.overallStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {telemetry.activeRouteSummary} • Aggregate Capacity:{' '}
              <span className="text-cyan-300 font-mono font-semibold">
                {telemetry.totalCapacityDownMbps} Mbps Down / {telemetry.totalCapacityUpMbps} Mbps Up
              </span>
            </p>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('templates')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
            title="Browse 10 Multi-WAN Sample Presets"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sample Library (10)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('validation-diff')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Dry Run & Validate</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white text-[9px] font-mono">
                {errorCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('cli-preview')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preview CLI</span>
          </button>
          <button
            onClick={handleExportRscFile}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-300" />
            <span>Export .rsc</span>
          </button>
          <button
            onClick={handleApplyToRouter}
            className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply to Virtual Router</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`px-4 py-2 border-b text-xs flex items-center justify-between shrink-0 ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
              : bannerMessage.type === 'error'
              ? 'bg-rose-950/70 border-rose-800/80 text-rose-200'
              : 'bg-cyan-950/70 border-cyan-800/80 text-cyan-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : bannerMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            onClick={() => setBannerMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* 3 Core Architecture Template Cards + Sub-Navigation Tabs */}
      <div className="px-4 pt-3 pb-2 bg-slate-900/50 border-b border-slate-800 shrink-0 space-y-2.5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {[
            {
              id: 'failover' as MultiWanTemplateType,
              title: '1. FAILOVER (ACTIVE / STANDBY)',
              subtitle: 'Primary + Secondary + Dynamic Backup Priority',
              desc: 'Menggunakan Recursive Route / Gateway Ping & Route Distance (1, 2, 3...) untuk memindahkan trafik otomatis saat link atau internet ISP utama terputus.',
              badge: 'High Availability',
            },
            {
              id: 'load-balancing' as MultiWanTemplateType,
              title: '2. LOAD BALANCING (PCC / ECMP / WEIGHTED)',
              subtitle: 'Per-Connection Classifier & Auto Bandwidth Ratio',
              desc: 'Mendistribusikan sesi koneksi secara merata atau proporsional sesuai rasio bandwidth ISP (mis. 300:200:100 → 3:2:1) dengan sticky connection tracking.',
              badge: `Ratio ${weightedCalc.ratioLabel}`,
            },
            {
              id: 'hybrid' as MultiWanTemplateType,
              title: '3. HYBRID (PBR + PCC + FAILOVER)',
              subtitle: 'Policy-Based VLAN, Subnet & Application Routing',
              desc: 'Kombinasi Policy Routing per VLAN/Subnet/Port (mis. VLAN Dosen → WAN1 Prioritas; Lab Kelas → PCC WAN1+WAN2 + Backup WAN3).',
              badge: `${mwan.hybridPolicies.filter((p) => p.enabled).length} Active Policies`,
            },
          ].map((tpl) => {
            const active = mwan.activeTemplate === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => handleSelectCoreTemplate(tpl.id)}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                  active
                    ? 'bg-cyan-950/40 border-cyan-500/80 shadow-xs'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-bold font-mono ${
                      active ? 'text-cyan-300' : 'text-slate-200'
                    }`}
                  >
                    {tpl.title}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tpl.badge}
                  </span>
                </div>
                <div className="text-[10.5px] font-semibold text-slate-300 mt-0.5">
                  {tpl.subtitle}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {tpl.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Workspace Sub-Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'wizard', label: '1. Configuration Wizard & Topology', icon: Sliders },
              { id: 'templates', label: '2. Sample Library (10 Presets)', icon: Sparkles },
              { id: 'monitoring', label: '3. Simulation Test & Live Monitoring', icon: Activity },
              {
                id: 'validation-diff',
                label: `4. Validation & Dry Run (${errorCount} Err / ${warningCount} Warn)`,
                icon: ShieldCheck,
              },
              { id: 'cli-preview', label: `5. CLI Script (${config.version.toUpperCase()})`, icon: FileCode },
              { id: 'snapshots', label: `6. Snapshots & Rollback (${config.backups.length})`, icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as ManagerWorkspaceTab)}
                  className={`px-2.5 py-1.5 rounded-t-md text-[11px] font-semibold flex items-center gap-1.5 border-t border-x transition-colors ${
                    isSelected
                      ? 'bg-slate-950 text-cyan-400 border-slate-700'
                      : 'bg-slate-900/60 text-slate-400 border-transparent hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleResetWizard}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[10.5px] flex items-center gap-1"
            title="Reset Wizard Configuration"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Wizard</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Workspace Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================ */}
        {/* TAB 1: CONFIGURATION WIZARD & INTERACTIVE TOPOLOGY PREVIEW   */}
        {/* ============================================================ */}
        {activeSubTab === 'wizard' && (
          <div className="space-y-4">
            {/* Interactive Multi-WAN Topology Diagram + Configuration Summary */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Topology Preview Diagram */}
              <div className="xl:col-span-2 bg-slate-900/80 border border-slate-800 rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-cyan-400" />
                      <span>MULTI-WAN TOPOLOGY & ROUTING FLOW PREVIEW</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Visualisasi alur paket dari LAN/VLAN menuju Mangle PBR/PCC, tabel FIB, hingga gateway & recursive host tiap ISP.
                    </p>
                  </div>
                  <span className="text-[10.5px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                    {mwan.wans.length} Active WAN Slots
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-950/90 border border-slate-800/90 rounded-lg p-3">
                  {/* Left: LAN / VLAN Segments */}
                  <div className="md:col-span-3 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                      Ingress LAN / VLANs
                    </div>
                    {mwan.activeTemplate === 'hybrid' ? (
                      mwan.hybridPolicies.slice(0, 4).map((pol) => (
                        <div
                          key={pol.id}
                          className="p-2 rounded bg-slate-900 border border-slate-800 text-[10.5px]"
                        >
                          <div className="font-bold text-cyan-300 truncate">{pol.name}</div>
                          <div className="text-slate-400 font-mono text-[9.5px] mt-0.5">
                            {pol.inInterfaceOrVlan ? `if=${pol.inInterfaceOrVlan} ` : ''}
                            {pol.srcAddress || 'any'} • {pol.routingMode.toUpperCase()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="space-y-1.5">
                        {mwan.localLanSubnets.map((sub, i) => (
                          <div
                            key={i}
                            className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[10.5px] font-mono"
                          >
                            <span className="text-slate-300">LOCAL-LAN #{i + 1}</span>
                            <span className="text-cyan-400">{sub}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Center: RouterOS Mangle & FIB Engine */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-lg bg-slate-900/90 border border-cyan-500/40 text-center space-y-1.5">
                    <div className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold">
                      {config.identity.name} ({device.modelName})
                    </div>
                    <div className="text-[11px] font-bold text-white">
                      {mwan.activeTemplate === 'failover'
                        ? 'Recursive Route + Distance Failover'
                        : mwan.activeTemplate === 'load-balancing'
                        ? `Mangle ${mwan.loadBalancingMethod.toUpperCase()}`
                        : 'Mangle Hybrid PBR + PCC + Failover'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 space-y-0.5 w-full pt-1 border-t border-slate-800">
                      <div>
                        • Mangle Rules:{' '}
                        <span className="text-cyan-300 font-bold">
                          {generatedForPreview.mangleRules.length}
                        </span>
                      </div>
                      <div>
                        • Routing Tables:{' '}
                        <span className="text-cyan-300 font-bold">
                          {generatedForPreview.routingTables.map((t) => t.name).join(', ')}
                        </span>
                      </div>
                      <div>
                        • Static/Recursive Routes:{' '}
                        <span className="text-cyan-300 font-bold">
                          {generatedForPreview.routes.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Dynamic WAN Links & Health Targets */}
                  <div className="md:col-span-5 space-y-2">
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                      Egress WAN Interfaces & ISP Health Status
                    </div>
                    {telemetry.wans.map((wm) => {
                      const wanCfg = mwan.wans.find((w) => w.id === wm.wanId);
                      return (
                        <div
                          key={wm.wanId}
                          className={`p-2 rounded border transition-all ${
                            wm.isActiveRoute
                              ? 'bg-slate-900 border-emerald-500/50'
                              : 'bg-slate-900/50 border-slate-800 opacity-80'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <div className="flex items-center gap-1.5 font-mono font-bold">
                              <span className="text-white">{wm.wanName}</span>
                              <span className="text-cyan-400">({wm.physicalInterface})</span>
                              <span className="text-slate-400 font-sans font-normal truncate max-w-[130px]">
                                • {wm.ispProviderName}
                              </span>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border ${
                                STATUS_BADGE_STYLES[wm.operationalStatus]
                              }`}
                            >
                              {wm.operationalStatus}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-[10px] font-mono text-slate-400">
                            <span>
                              GW: <strong className="text-slate-200">{wanCfg?.gateway}</strong> → Check:{' '}
                              <strong className="text-cyan-300">{wanCfg?.healthCheckTarget}</strong>
                            </span>
                            <span>
                              Share: <strong className="text-emerald-300">{wm.packetSharePercent}%</strong> ({wm.currentDownloadMbps}/{wm.downloadCapacityMbps}M)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Configuration Summary & Technical Guardrails */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CONFIGURATION SUMMARY</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[9.5px]">ACTIVE TEMPLATE</span>
                      <span className="text-cyan-300 font-bold uppercase">{mwan.activeTemplate}</span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[9.5px]">ROUTEROS SYNTAX</span>
                      <span className="text-emerald-300 font-bold">
                        {config.version === 'v7' ? 'v7 (FIB Tables)' : 'v6 (Routing Marks)'}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[9.5px]">GENERATED MANGLE</span>
                      <span className="text-white font-bold">
                        {generatedForPreview.mangleRules.length} Rules
                      </span>
                    </div>
                    <div className="p-2 rounded bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[9.5px]">GENERATED ROUTES</span>
                      <span className="text-white font-bold">
                        {generatedForPreview.routes.length} Routes
                      </span>
                    </div>
                  </div>

                  {/* Technical Architecture Note: Load Balancing vs Bonding */}
                  <div className="p-2.5 rounded bg-amber-950/30 border border-amber-700/40 text-[10.5px] text-amber-200/90 leading-relaxed">
                    <div className="font-bold text-amber-300 flex items-center gap-1 mb-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Catatan Arsitektur MikroTik PCC vs Bonding:</span>
                    </div>
                    Load Balancing PCC mendistribusikan <strong>multi-koneksi (per-flow)</strong> secara proporsional di seluruh link WAN (kapasitas agregat {telemetry.totalCapacityDownMbps} Mbps), bukan menggabungkan kecepatan satu koneksi tunggal (single-connection bonding). Connection mark menjaga sesi HTTPS/Banking tetap keluar melalui IP publik WAN yang sama.
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setActiveSubTab('monitoring')}
                    className="flex-1 py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Test in Simulator</span>
                  </button>
                  <button
                    onClick={handleApplyToRouter}
                    className="flex-1 py-1.5 px-2.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Apply Now</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION C: DYNAMIC WAN INTERFACES CONFIGURATION TABLE        */}
            {/* ============================================================ */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                    DYNAMIC WAN INTERFACES & ISP SLA PARAMETERS ({mwan.wans.length} WANs)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Jumlah WAN dinamis mengikuti port fisik perangkat ({physicalInterfaces.join(', ')}). Konfigurasikan tipe koneksi, bandwidth, CIR, contention ratio, dan target health-check.
                  </p>
                </div>
                <button
                  onClick={handleAddWan}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add WAN Link</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {mwan.wans.map((wan, idx) => {
                  const metric = telemetry.wans.find((m) => m.wanId === wan.id);
                  return (
                    <div
                      key={wan.id}
                      className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2.5"
                    >
                      {/* WAN Card Header */}
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono font-bold text-xs">
                            {wan.name}
                          </span>
                          <input
                            type="text"
                            value={wan.ispProviderName}
                            list={`isp-list-${wan.id}`}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'ispProviderName', e.target.value)
                            }
                            placeholder="Nama ISP Provider"
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-semibold w-48 focus:outline-none focus:border-cyan-500"
                          />
                          <datalist id={`isp-list-${wan.id}`}>
                            {ispProviderSuggestions.map((p) => (
                              <option key={p} value={p} />
                            ))}
                          </datalist>
                        </div>

                        <div className="flex items-center gap-2">
                          {metric && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                STATUS_BADGE_STYLES[metric.operationalStatus]
                              }`}
                            >
                              {metric.operationalStatus}
                            </span>
                          )}
                          <button
                            disabled={mwan.wans.length <= 2}
                            onClick={() => handleRemoveWan(wan.id)}
                            className="p-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 disabled:opacity-30 border border-rose-800/60"
                            title="Hapus WAN ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row 1: Physical Interface, Connection Type, Role, Route Distance */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            Physical Port
                          </label>
                          <select
                            value={wan.physicalInterface}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'physicalInterface', e.target.value)
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                          >
                            {physicalInterfaces.map((ifName) => (
                              <option key={ifName} value={ifName}>
                                {ifName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            Connection Type
                          </label>
                          <select
                            value={wan.connectionType}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'connectionType',
                                e.target.value as WanConnectionType
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                          >
                            <option value="static">Static IP</option>
                            <option value="dhcp">DHCP Client</option>
                            <option value="pppoe">PPPoE Client</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            WAN Role
                          </label>
                          <select
                            value={wan.role}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'role', e.target.value as WanRole)
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                          >
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                            <option value="backup">Backup (Standby)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            Priority / Distance
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={255}
                              value={wan.distance}
                              onChange={(e) => {
                                const d = Math.max(1, Number(e.target.value) || idx + 1);
                                const nextWans = mwan.wans.map((w) =>
                                  w.id === wan.id ? { ...w, distance: d, priority: d } : w
                                );
                                persistMultiWanDraft(
                                  { ...mwan, wans: nextWans },
                                  `Update distance on ${wan.name}`
                                );
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Row 2: IP Address, Gateway, Health Check Method & Target */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            WAN IP / CIDR
                          </label>
                          <input
                            type="text"
                            value={wan.ipAddress}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'ipAddress', e.target.value)
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            ISP Gateway IP
                          </label>
                          <input
                            type="text"
                            value={wan.gateway}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'gateway', e.target.value)
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            Health Check Mode
                          </label>
                          <select
                            value={wan.healthCheckMethod}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'healthCheckMethod',
                                e.target.value as WanHealthCheckMethod
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                          >
                            <option value="recursive-route">Recursive Route</option>
                            <option value="simple-gateway">Simple Gateway Ping</option>
                            <option value="external-target">External Host Check</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                            Health-Check Target
                          </label>
                          <input
                            type="text"
                            value={wan.healthCheckTarget}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'healthCheckTarget', e.target.value)
                            }
                            placeholder="8.8.8.8"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-mono text-[11px]"
                          />
                        </div>
                      </div>

                      {/* Optional PPPoE Credentials if PPPoE is selected */}
                      {wan.connectionType === 'pppoe' && (
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              PPPoE Username
                            </label>
                            <input
                              type="text"
                              value={wan.pppoeUsername || ''}
                              onChange={(e) =>
                                handleUpdateWanField(wan.id, 'pppoeUsername', e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              PPPoE Password
                            </label>
                            <input
                              type="text"
                              value={wan.pppoePassword || ''}
                              onChange={(e) =>
                                handleUpdateWanField(wan.id, 'pppoePassword', e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Row 3: Bandwidth, CIR, Contention Ratio, Latency, Jitter, Loss */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1 text-[11px]">
                        <div>
                          <label className="text-[9.5px] text-slate-400 font-mono block mb-0.5">
                            Down (Mbps)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={wan.downloadMbps}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'downloadMbps',
                                Math.max(1, Number(e.target.value) || 10)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px] tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="text-[9.5px] text-slate-400 font-mono block mb-0.5">
                            Up (Mbps)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={wan.uploadMbps}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'uploadMbps',
                                Math.max(1, Number(e.target.value) || 10)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px] tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="text-[9.5px] text-slate-400 font-mono block mb-0.5">
                            CIR (Mbps)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={wan.cirMbps}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'cirMbps',
                                Math.max(1, Number(e.target.value) || 10)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px] tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="text-[9.5px] text-slate-400 font-mono block mb-0.5">
                            Contention
                          </label>
                          <select
                            value={wan.contentionRatio}
                            onChange={(e) =>
                              handleUpdateWanField(wan.id, 'contentionRatio', e.target.value)
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px]"
                          >
                            <option value="1:1">1:1 (Dedicated)</option>
                            <option value="1:2">1:2</option>
                            <option value="1:4">1:4 (Broadband)</option>
                            <option value="1:8">1:8 (Shared)</option>
                            <option value="1:16">1:16</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9.5px] text-slate-400 font-mono block mb-0.5">
                            Latency (ms)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={wan.latencyMs}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'latencyMs',
                                Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px] tabular-nums"
                          />
                        </div>

                        <div>
                          <label className="text-[9.5px] text-slate-400 font-mono block mb-0.5">
                            Jitter (ms)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={wan.jitterMs}
                            onChange={(e) =>
                              handleUpdateWanField(
                                wan.id,
                                'jitterMs',
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px] tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTIONS D, E, F: TEMPLATE-SPECIFIC CONFIGURATION WIZARD     */}
            {/* ============================================================ */}
            {mwan.activeTemplate === 'failover' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                  FAILOVER TEMPLATE PARAMETERS (DYNAMIC BACKUP PRIORITY & RECURSIVE ROUTING)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="font-bold text-white block">
                      Default Failover Health-Check Mode
                    </label>
                    <select
                      value={mwan.failoverCheckMethod}
                      onChange={(e) => {
                        const mode = e.target.value as WanHealthCheckMethod;
                        const updatedWans = mwan.wans.map((w) => ({
                          ...w,
                          healthCheckMethod: mode,
                        }));
                        persistMultiWanDraft(
                          { ...mwan, failoverCheckMethod: mode, wans: updatedWans },
                          `Set Failover Check Method: ${mode}`
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                    >
                      <option value="recursive-route">
                        Recursive Route (scope=10 / target-scope=11) — Recommended
                      </option>
                      <option value="simple-gateway">
                        Simple Gateway Check (check-gateway=ping ke IP Modem)
                      </option>
                      <option value="external-target">
                        External Health-Check Target (Custom Public IP)
                      </option>
                    </select>
                    <p className="text-[10.5px] text-slate-400">
                      Recursive Route mendeteksi gangguan di dalam jaringan upstream ISP meskipun modem/ONT lokal masih bisa di-ping.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="font-bold text-white block">
                      Automatic Route Recovery (Preemption)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={mwan.autoRecovery}
                        onChange={(e) =>
                          persistMultiWanDraft(
                            { ...mwan, autoRecovery: e.target.checked },
                            'Toggle Auto Recovery'
                          )
                        }
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span className="text-slate-200 text-xs">
                        Kembalikan trafik otomatis ke Primary WAN saat pulih (UP)
                      </span>
                    </label>
                    <p className="text-[10.5px] text-slate-400">
                      Saat Primary WAN (distance=1) kembali sehat, FIB otomatis memilih kembali route dengan nilai distance terkecil.
                    </p>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="font-bold text-white block">
                      Urutan Prioritas Failover Saat Ini
                    </label>
                    <div className="space-y-1 font-mono text-[11px]">
                      {[...mwan.wans]
                        .sort((a, b) => a.distance - b.distance)
                        .map((w, i) => (
                          <div key={w.id} className="flex items-center justify-between">
                            <span className="text-slate-300">
                              #{i + 1} {w.name} ({w.physicalInterface})
                            </span>
                            <span className="text-cyan-400">
                              distance={w.distance} ({w.role})
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mwan.activeTemplate === 'load-balancing' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                  LOAD BALANCING TEMPLATE PARAMETERS (PCC, ECMP & WEIGHTED BANDWIDTH RATIO)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                    <label className="font-bold text-white block">
                      Load Balancing Algorithm / Classifier
                    </label>
                    <select
                      value={mwan.loadBalancingMethod}
                      onChange={(e) =>
                        persistMultiWanDraft(
                          {
                            ...mwan,
                            loadBalancingMethod: e.target.value as LoadBalancingMethod,
                          },
                          `Change Load Balancing Method`
                        )
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                    >
                      <option value="pcc-both-addresses-and-ports">
                        PCC: both-addresses-and-ports (Granular Per-Flow)
                      </option>
                      <option value="pcc-both-addresses">
                        PCC: both-addresses (Safe for HTTPS / Banking)
                      </option>
                      <option value="pcc-src-address">
                        PCC: src-address (Sticky Per Client IP)
                      </option>
                      <option value="pcc-dst-address">
                        PCC: dst-address (Per Destination Server)
                      </option>
                      <option value="weighted-pcc">
                        Weighted PCC (Proporsional Rasio Bandwidth ISP)
                      </option>
                      <option value="ecmp">
                        ECMP (Equal-Cost Multi-Path Gateway Route)
                      </option>
                    </select>
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-white">
                        Weighted PCC Ratio Calculator
                      </label>
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono text-[10.5px] font-bold">
                        {weightedCalc.ratioLabel} ({weightedCalc.totalStreams} Streams)
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mwan.useAutoBandwidthWeight}
                        onChange={(e) =>
                          persistMultiWanDraft(
                            { ...mwan, useAutoBandwidthWeight: e.target.checked },
                            'Toggle Auto Bandwidth Weight'
                          )
                        }
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span className="text-[11px] text-slate-300">
                        Hitung otomatis dari rasio Download Bandwidth ISP
                      </span>
                    </label>
                    {!mwan.useAutoBandwidthWeight && (
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {mwan.wans.map((w) => (
                          <div key={w.id} className="text-[10px] font-mono">
                            <span className="text-slate-400 block">{w.name} Weight:</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={w.manualWeight || 1}
                              onChange={(e) =>
                                handleUpdateWanField(
                                  w.id,
                                  'manualWeight',
                                  Math.max(1, Number(e.target.value) || 1)
                                )
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-2">
                    <label className="font-bold text-white block">
                      Connection Tracking & Unhealthy WAN Failover
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mwan.connectionTrackingSticky}
                        onChange={(e) =>
                          persistMultiWanDraft(
                            { ...mwan, connectionTrackingSticky: e.target.checked },
                            'Toggle Sticky Connection Mark'
                          )
                        }
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span className="text-[11px] text-slate-300">
                        Sticky Connection Mark (In/Out WAN Symmetry)
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mwan.autoFailoverUnhealthyWan}
                        onChange={(e) =>
                          persistMultiWanDraft(
                            { ...mwan, autoFailoverUnhealthyWan: e.target.checked },
                            'Toggle Auto Failover for Unhealthy WAN'
                          )
                        }
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500"
                      />
                      <span className="text-[11px] text-slate-300">
                        Sertakan Backup Failover Route di setiap tabel to-WANx
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {mwan.activeTemplate === 'hybrid' && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                      HYBRID POLICY-BASED ROUTING + PCC + FAILOVER RULES ({mwan.hybridPolicies.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Atur prioritas policy berdasarkan VLAN, Source/Destination Subnet, atau Aplikasi/Port. Setiap policy dapat diarahkan ke Single WAN Failover, PCC, atau Weighted PCC beserta jalur Backup WAN.
                    </p>
                  </div>
                  <button
                    onClick={handleAddHybridPolicy}
                    className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Hybrid Policy</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {[...mwan.hybridPolicies]
                    .sort((a, b) => a.priority - b.priority)
                    .map((pol, idx) => (
                      <div
                        key={pol.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          pol.enabled
                            ? 'bg-slate-950/90 border-slate-800'
                            : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono font-bold text-[11px]">
                              Priority #{pol.priority}
                            </span>
                            <input
                              type="text"
                              value={pol.name}
                              onChange={(e) =>
                                handleUpdateHybridPolicy(pol.id, { name: e.target.value })
                              }
                              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-semibold text-white w-72"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <label className="flex items-center gap-1.5 text-[11px] mr-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pol.enabled}
                                onChange={(e) =>
                                  handleUpdateHybridPolicy(pol.id, { enabled: e.target.checked })
                                }
                              />
                              <span className="text-slate-300">Enabled</span>
                            </label>
                            <button
                              disabled={idx === 0}
                              onClick={() => handleMoveHybridPolicy(pol.id, 'up')}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 border border-slate-700"
                              title="Naikkan Prioritas"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={idx === mwan.hybridPolicies.length - 1}
                              onClick={() => handleMoveHybridPolicy(pol.id, 'down')}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-200 border border-slate-700"
                              title="Turunkan Prioritas"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHybridPolicy(pol.id)}
                              className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-800/60"
                              title="Hapus Policy"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2.5 text-[11px]">
                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              Policy Type
                            </label>
                            <select
                              value={pol.policyType}
                              onChange={(e) =>
                                handleUpdateHybridPolicy(pol.id, {
                                  policyType: e.target.value as HybridPolicyRule['policyType'],
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                            >
                              <option value="vlan">VLAN / In-Interface</option>
                              <option value="src-address">Source Subnet</option>
                              <option value="dst-address">Destination Subnet</option>
                              <option value="application">Application / Port</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              In-Interface / VLAN
                            </label>
                            <input
                              type="text"
                              value={pol.inInterfaceOrVlan || ''}
                              onChange={(e) =>
                                handleUpdateHybridPolicy(pol.id, {
                                  inInterfaceOrVlan: e.target.value,
                                })
                              }
                              placeholder="e.g. vlan20"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              Src. Address / CIDR
                            </label>
                            <input
                              type="text"
                              value={pol.srcAddress || ''}
                              onChange={(e) =>
                                handleUpdateHybridPolicy(pol.id, { srcAddress: e.target.value })
                              }
                              placeholder="10.20.0.0/24"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              Protocol & Dst. Port
                            </label>
                            <div className="flex gap-1">
                              <select
                                value={pol.protocol || 'all'}
                                onChange={(e) =>
                                  handleUpdateHybridPolicy(pol.id, {
                                    protocol: e.target.value as any,
                                  })
                                }
                                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px]"
                              >
                                <option value="all">all</option>
                                <option value="tcp">tcp</option>
                                <option value="udp">udp</option>
                                <option value="icmp">icmp</option>
                              </select>
                              <input
                                type="text"
                                value={pol.dstPort || ''}
                                onChange={(e) =>
                                  handleUpdateHybridPolicy(pol.id, { dstPort: e.target.value })
                                }
                                placeholder="443,5060"
                                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white font-mono text-[11px]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              Routing Mode
                            </label>
                            <select
                              value={pol.routingMode}
                              onChange={(e) =>
                                handleUpdateHybridPolicy(pol.id, {
                                  routingMode: e.target.value as HybridPolicyRule['routingMode'],
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-mono text-[11px]"
                            >
                              <option value="failover">Single WAN + Failover</option>
                              <option value="pcc">PCC Load Balancing</option>
                              <option value="weighted-pcc">Weighted PCC</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-400 font-mono block mb-0.5">
                              Preferred & Backup WANs
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {mwan.wans.map((w) => {
                                const isPref = pol.preferredWanIds.includes(w.id);
                                const isBkp = pol.backupWanIds.includes(w.id);
                                return (
                                  <button
                                    key={w.id}
                                    type="button"
                                    onClick={() => {
                                      if (!isPref && !isBkp) {
                                        handleToggleWanInPolicyList(pol, 'preferredWanIds', w.id);
                                      } else if (isPref) {
                                        // Move from Preferred to Backup
                                        handleUpdateHybridPolicy(pol.id, {
                                          preferredWanIds: pol.preferredWanIds.filter((id) => id !== w.id),
                                          backupWanIds: [...pol.backupWanIds, w.id],
                                        });
                                      } else {
                                        // Remove from Backup
                                        handleToggleWanInPolicyList(pol, 'backupWanIds', w.id);
                                      }
                                    }}
                                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border ${
                                      isPref
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                        : isBkp
                                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                                        : 'bg-slate-900 text-slate-500 border-slate-800'
                                    }`}
                                    title="Klik untuk mengganti status: Preferred (Hijau) -> Backup (Kuning) -> Nonaktif"
                                  >
                                    {w.name}:{isPref ? 'PRI' : isBkp ? 'BKP' : 'OFF'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: SAMPLE CONFIGURATION LIBRARY (10 PRESETS)             */}
        {/* ============================================================ */}
        {activeSubTab === 'templates' && (
          <div className="space-y-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  SAMPLE MULTI-WAN CONFIGURATION LIBRARY (10 PRODUCTION TEMPLATES)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Pilih salah satu preset siap pakai untuk dimuat ke Wizard, dikustomisasi, dilihat script CLI-nya, atau langsung diterapkan ke router virtual.
                </p>
              </div>
              <button
                onClick={handleResetWizard}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SAMPLE_MULTIWAN_TEMPLATES.map((preset) => {
                const isSelected = mwan.selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 transition-all ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/80'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-white">{preset.title}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{preset.description}</p>
                      <div className="text-[10.5px] font-mono text-slate-400 pt-1">
                        Recommended for: <span className="text-slate-200">{preset.recommendedFor}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => handleLoadSamplePreset(preset.id, false)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-semibold"
                      >
                        Load Template
                      </button>
                      <button
                        onClick={() => {
                          handleLoadSamplePreset(preset.id, false);
                          setActiveSubTab('wizard');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold"
                      >
                        Customize
                      </button>
                      <button
                        onClick={() => {
                          handleLoadSamplePreset(preset.id, false);
                          setActiveSubTab('cli-preview');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-[11px] font-semibold"
                      >
                        Preview CLI
                      </button>
                      <button
                        onClick={() => handleLoadSamplePreset(preset.id, true)}
                        className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold ml-auto"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: VISUAL MONITORING & 10 SIMULATION TEST SCENARIOS      */}
        {/* ============================================================ */}
        {activeSubTab === 'monitoring' && (
          <div className="space-y-4">
            {/* 10 Simulation Scenario Triggers */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" />
                    <span>MULTI-WAN FAULT INJECTION & SIMULATION LAB (10 SCENARIOS)</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Uji ketahanan konfigurasi Failover, PCC, dan Recursive Route terhadap 10 kondisi gangguan link, gateway, internet upstream, dan kongesti ISP.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-[11px] text-cyan-300">
                  Active Scenario: <strong>{mwan.activeScenario.toUpperCase()}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {MULTIWAN_SIMULATION_SCENARIOS.map((sc) => {
                  const isActive = mwan.activeScenario === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => handleRunSimulationScenario(sc.id)}
                      title={sc.description}
                      className={`p-2 rounded border text-left transition-all ${
                        isActive
                          ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-xs'
                          : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-[10.5px] font-bold font-mono text-cyan-300 truncate">
                        {sc.number}. {sc.shortLabel}
                      </div>
                      <div className="text-[9.5px] text-slate-400 line-clamp-2 mt-0.5">
                        {sc.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Per-WAN Real-Time Telemetry Cards & Multi-Layer Health Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {telemetry.wans.map((wm) => (
                <div
                  key={wm.wanId}
                  className={`p-3.5 rounded-lg border space-y-2.5 ${
                    wm.operationalStatus === 'DOWN'
                      ? 'bg-rose-950/15 border-rose-800/60'
                      : wm.operationalStatus === 'DEGRADED'
                      ? 'bg-amber-950/15 border-amber-800/60'
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-white">{wm.wanName}</span>
                        <span className="text-xs font-mono text-cyan-400">
                          ({wm.physicalInterface})
                        </span>
                        {wm.isActiveRoute && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9.5px] font-mono font-bold">
                            ACTIVE ROUTE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{wm.ispProviderName}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-bold border ${
                        STATUS_BADGE_STYLES[wm.operationalStatus]
                      }`}
                    >
                      {wm.operationalStatus}
                    </span>
                  </div>

                  {/* 4-Layer Reachability Matrix: Link / Gateway / Internet / Service */}
                  <div className="grid grid-cols-4 gap-1 text-[9.5px] font-mono text-center">
                    <div
                      className={`p-1 rounded border ${
                        wm.linkState === 'UP'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : 'bg-rose-950/60 border-rose-800 text-rose-300'
                      }`}
                    >
                      <span className="block text-[8.5px] text-slate-400">LINK</span>
                      {wm.linkState}
                    </div>
                    <div
                      className={`p-1 rounded border ${
                        wm.gatewayState === 'REACHABLE'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : 'bg-rose-950/60 border-rose-800 text-rose-300'
                      }`}
                    >
                      <span className="block text-[8.5px] text-slate-400">GATEWAY</span>
                      {wm.gatewayState === 'REACHABLE' ? 'OK' : 'FAIL'}
                    </div>
                    <div
                      className={`p-1 rounded border ${
                        wm.internetState === 'ONLINE'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : 'bg-rose-950/60 border-rose-800 text-rose-300'
                      }`}
                    >
                      <span className="block text-[8.5px] text-slate-400">INTERNET</span>
                      {wm.internetState}
                    </div>
                    <div
                      className={`p-1 rounded border ${
                        wm.serviceState === 'AVAILABLE'
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : wm.serviceState === 'DEGRADED'
                          ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                          : 'bg-rose-950/60 border-rose-800 text-rose-300'
                      }`}
                    >
                      <span className="block text-[8.5px] text-slate-400">SERVICE</span>
                      {wm.serviceState === 'AVAILABLE' ? 'OK' : wm.serviceState}
                    </div>
                  </div>

                  {/* Bandwidth Utilization Bars */}
                  <div className="space-y-1.5 text-[10.5px] font-mono">
                    <div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          RX Download: <strong className="text-white">{wm.currentDownloadMbps} Mbps</strong> / {wm.downloadCapacityMbps}M (CIR {wm.cirMbps}M)
                        </span>
                        <span className="text-cyan-300 font-bold">{wm.utilizationDownPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded overflow-hidden mt-0.5">
                        <div
                          className={`h-full transition-all ${
                            wm.utilizationDownPercent >= 85
                              ? 'bg-rose-500'
                              : wm.utilizationDownPercent >= 65
                              ? 'bg-amber-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${wm.utilizationDownPercent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">
                          TX Upload: <strong className="text-white">{wm.currentUploadMbps} Mbps</strong> / {wm.uploadCapacityMbps}M
                        </span>
                        <span className="text-emerald-300 font-bold">{wm.utilizationUpPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${wm.utilizationUpPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SLA & Session Metrics */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono text-center">
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className="block text-slate-500 text-[8.5px]">SHARE</span>
                      <span className="text-cyan-300 font-bold">{wm.packetSharePercent}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className="block text-slate-500 text-[8.5px]">CONNS</span>
                      <span className="text-white font-bold">{wm.activeConnections}</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className="block text-slate-500 text-[8.5px]">RTT / JITTER</span>
                      <span className="text-white font-bold">
                        {wm.effectiveLatencyMs} / {wm.effectiveJitterMs}ms
                      </span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <span className="block text-slate-500 text-[8.5px]">LOSS</span>
                      <span
                        className={`font-bold ${
                          wm.effectivePacketLossPercent > 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {wm.effectivePacketLossPercent}%
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
                    {wm.statusReason}
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Packet Traceroute Tester & Failover Event Log */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Packet Trace Tester */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  INTERACTIVE MULTI-WAN PACKET TRACE VERIFIER
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={simTestTargetIp}
                    onChange={(e) => setSimTestTargetIp(e.target.value)}
                    placeholder="Target IP (e.g. 8.8.8.8)"
                    className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs w-40"
                  />
                  <select
                    value={simTestProtocol}
                    onChange={(e) => setSimTestProtocol(e.target.value as any)}
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono text-xs"
                  >
                    <option value="TCP">TCP</option>
                    <option value="UDP">UDP</option>
                    <option value="ICMP">ICMP</option>
                  </select>
                  <input
                    type="number"
                    value={simTestDstPort}
                    onChange={(e) => setSimTestDstPort(Number(e.target.value) || 443)}
                    placeholder="Dst Port"
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white font-mono text-xs w-24"
                  />
                  <button
                    onClick={handleExecutePacketSimulationTest}
                    className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Trace Test</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-[10.5px] text-slate-300 h-44 overflow-y-auto space-y-1">
                  {simTestResultText.length === 0 ? (
                    <div className="text-slate-500">
                      Klik &quot;Run Trace Test&quot; untuk melihat jalur Mangle, Routing Table, NAT Masquerade, dan ISP Gateway yang dipilih paket.
                    </div>
                  ) : (
                    simTestResultText.map((line, i) => (
                      <div key={i} className="leading-relaxed">
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Failover & Recovery Event Log */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  FAILOVER, RECOVERY & ROUTE CHANGE EVENT LOG
                </h3>
                <div className="bg-slate-950 border border-slate-800 rounded p-2.5 font-mono text-[10.5px] h-56 overflow-y-auto space-y-2">
                  {(mwan.events || []).map((evt) => (
                    <div
                      key={evt.id}
                      className="pb-1.5 border-b border-slate-900 last:border-none"
                    >
                      <div className="flex items-center justify-between text-[9.5px] text-slate-500">
                        <span
                          className={`font-bold ${
                            evt.type === 'FAILOVER'
                              ? 'text-rose-400'
                              : evt.type === 'RECOVERY'
                              ? 'text-emerald-400'
                              : evt.type === 'DEGRADED'
                              ? 'text-amber-400'
                              : 'text-cyan-400'
                          }`}
                        >
                          [{evt.type}] {evt.wanName || ''}
                        </span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-slate-200 mt-0.5">{evt.message}</div>
                      {evt.routeAction && (
                        <div className="text-cyan-400/90 text-[9.5px] mt-0.5">
                          ↳ {evt.routeAction}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: PRE-APPLY VALIDATION & DRY RUN DIFF VIEWER            */}
        {/* ============================================================ */}
        {activeSubTab === 'validation-diff' && (
          <div className="space-y-4">
            {/* Validation Checklist */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  PRE-APPLY CONFIGURATION VALIDATION & SAFETY AUDIT
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded font-mono text-xs font-bold ${
                    dryRunPreview.valid
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-700'
                  }`}
                >
                  {dryRunPreview.valid ? 'READY TO APPLY (VALID)' : `${errorCount} BLOCKING ERRORS`}
                </span>
              </div>

              <div className="space-y-2">
                {validationIssues.map((iss) => (
                  <div
                    key={iss.id}
                    className={`p-2.5 rounded border text-xs flex items-start gap-2.5 ${
                      iss.severity === 'error'
                        ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                        : iss.severity === 'warning'
                        ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                        : 'bg-cyan-950/30 border-cyan-800/60 text-cyan-200'
                    }`}
                  >
                    <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/30">
                      {iss.severity}
                    </span>
                    <div className="flex-1">
                      <div className="font-bold">{iss.title}</div>
                      <div className="text-[11px] opacity-90 mt-0.5">{iss.message}</div>
                      {iss.remediation && (
                        <div className="text-[10.5px] font-mono mt-1 underline">
                          Solusi: {iss.remediation}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dry Run Summary & Diff */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                    DRY RUN CHANGE PREVIEW (BEFORE vs AFTER APPLY)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Menampilkan perubahan yang akan diterapkan ke {device.name}. Rule kustom non-[MWAN] Anda tetap dipertahankan.
                  </p>
                </div>
                <button
                  disabled={!dryRunPreview.valid}
                  onClick={handleApplyToRouter}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Apply Changes</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono text-xs">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="block text-[9.5px] text-slate-400">NEW MANGLE RULES</span>
                  <span className="text-emerald-400 font-bold">
                    +{dryRunPreview.summary.addedMangleRules}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="block text-[9.5px] text-slate-400">NEW IP ROUTES</span>
                  <span className="text-emerald-400 font-bold">
                    +{dryRunPreview.summary.addedRoutes}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="block text-[9.5px] text-slate-400">NEW NAT RULES</span>
                  <span className="text-emerald-400 font-bold">
                    +{dryRunPreview.summary.addedNatRules}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="block text-[9.5px] text-slate-400">REPLACED [MWAN]</span>
                  <span className="text-amber-400 font-bold">
                    -{dryRunPreview.summary.removedMwanMangleRules + dryRunPreview.summary.removedMwanRoutes}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <span className="block text-[9.5px] text-slate-400">PRESERVED CUSTOM</span>
                  <span className="text-cyan-400 font-bold">
                    {dryRunPreview.summary.preservedCustomRules}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded p-3 font-mono text-[11px] max-h-80 overflow-y-auto space-y-0.5">
                {dryRunPreview.diffLines.map((d, idx) => (
                  <div
                    key={idx}
                    className={`px-1.5 py-0.5 rounded ${
                      d.type === 'added'
                        ? 'bg-emerald-950/50 text-emerald-300'
                        : d.type === 'removed'
                        ? 'bg-rose-950/50 text-rose-300 line-through opacity-75'
                        : 'text-slate-400'
                    }`}
                  >
                    {d.type === 'added' ? '+ ' : d.type === 'removed' ? '- ' : '  '}
                    {d.line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: ROUTEROS v6 / v7 CLI SCRIPT PREVIEW & EXPORT          */}
        {/* ============================================================ */}
        {activeSubTab === 'cli-preview' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  GENERATED MIKROTIK ROUTEROS CLI SCRIPT (.RSC)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Sintaks murni tanpa pencampuran versi: RouterOS v6 menggunakan <code className="text-cyan-300">routing-mark</code>, sedangkan RouterOS v7 menggunakan <code className="text-cyan-300">/routing table fib</code> & <code className="text-cyan-300">routing-table</code>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex rounded bg-slate-950 p-0.5 border border-slate-800 text-xs font-mono">
                  <button
                    onClick={() => setCliPreviewVersion('v6')}
                    className={`px-2.5 py-1 rounded ${
                      cliPreviewVersion === 'v6'
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    RouterOS v6
                  </button>
                  <button
                    onClick={() => setCliPreviewVersion('v7')}
                    className={`px-2.5 py-1 rounded ${
                      cliPreviewVersion === 'v7'
                        ? 'bg-cyan-600 text-white font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    RouterOS v7
                  </button>
                </div>

                <button
                  onClick={handleCopyCliScript}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedCli ? 'Copied!' : 'Copy Script'}</span>
                </button>

                <button
                  onClick={handleExportRscFile}
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .rsc</span>
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-[480px] leading-relaxed select-text">
              {generatedForPreview.cliScript}
            </pre>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 6: CONFIGURATION SNAPSHOTS & ROLLBACK MANAGER            */}
        {/* ============================================================ */}
        {activeSubTab === 'snapshots' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  CONFIGURATION SNAPSHOTS & SAFE ROLLBACK
                </h3>
                <p className="text-[11px] text-slate-400">
                  Setiap kali Anda menekan &quot;Apply to Virtual Router&quot;, sistem otomatis membuat snapshot cadangan sehingga Anda dapat melakukan Rollback kapan saja.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={snapshotNameInput}
                  onChange={(e) => setSnapshotNameInput(e.target.value)}
                  placeholder="Nama snapshot (opsional)"
                  className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono w-56"
                />
                <button
                  onClick={handleCreateSnapshot}
                  className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Create Snapshot</span>
                </button>
              </div>
            </div>

            {config.backups.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs bg-slate-950 rounded border border-slate-800">
                Belum ada configuration snapshot tersimpan. Klik &quot;Create Snapshot&quot; atau terapkan konfigurasi Multi-WAN untuk membuat auto-snapshot.
              </div>
            ) : (
              <div className="space-y-2">
                {config.backups.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-cyan-300">{b.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {b.description || 'Manual RouterOS Configuration Snapshot'} • Created:{' '}
                        {new Date(b.createdAt).toLocaleString()} • ROS {b.routerOsVersion} ({b.sizeBytes} bytes)
                      </div>
                    </div>
                    <button
                      onClick={() => handleRollbackSnapshot(b.id, b.name)}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Rollback to This Snapshot</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
