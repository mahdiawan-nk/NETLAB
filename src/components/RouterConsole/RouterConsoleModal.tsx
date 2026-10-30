import React, { useState, useEffect, useMemo } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { RouterOsConfigService, hasRouterOsSupport } from '../../services/routerOsConfigService';
import {
  RouterOsVerificationSuite,
  VerificationSuiteReport,
} from '../../services/routerOsVerificationSuite';
import { RouterOsDeviceConfig } from '../../types/routerOs';
import { RouterOsCliTerminal } from './RouterOsCliTerminal';
import { WinboxGuiManager } from './WinboxGuiManager';
import {
  X,
  Terminal,
  Layout,
  Archive,
  Cpu,
  HardDrive,
  Clock,
  Download,
  Copy,
  Check,
  Plus,
  RotateCcw,
  Trash2,
  GitCompare,
  History,
  FileCode,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Play,
  HelpCircle,
} from 'lucide-react';

export const RouterConsoleModal: React.FC = () => {
  const {
    activeProject,
    routerConsoleState,
    closeRouterConsole,
    mutateRouterOsConfig,
    deviceProcessingMetrics,
    auditLogs,
    openUserGuide,
    customDevices,
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<'terminal' | 'winbox' | 'backup'>(
    routerConsoleState.initialTab || 'terminal'
  );

  // Sub-tab inside Configuration Management ('backup')
  const [configSubTab, setConfigSubTab] = useState<'rsc' | 'snapshots' | 'diff' | 'history' | 'test-suite'>('rsc');
  const [backupNameInput, setBackupNameInput] = useState('');
  const [selectedDiffTargetId, setSelectedDiffTargetId] = useState<string>('factory');
  const [copiedRsc, setCopiedRsc] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testSuiteReport, setTestSuiteReport] = useState<VerificationSuiteReport | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'amber' | 'rose';
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (routerConsoleState.isOpen && routerConsoleState.initialTab) {
      setActiveTab(routerConsoleState.initialTab);
    }
  }, [routerConsoleState.isOpen, routerConsoleState.initialTab, routerConsoleState.deviceId]);

  const device = useMemo(() => {
    if (!routerConsoleState.isOpen || !routerConsoleState.deviceId) return undefined;
    return activeProject.devices.find((d) => d.id === routerConsoleState.deviceId);
  }, [routerConsoleState.isOpen, routerConsoleState.deviceId, activeProject.devices]);

  const config = useMemo(() => {
    return device ? RouterOsConfigService.ensureConfig(device) : null;
  }, [device]);

  const runningRsc = useMemo(() => {
    return device ? RouterOsConfigService.exportRscScript(device) : '';
  }, [device]);

  // Compute baseline RSC for Configuration Diff
  const diffResult = useMemo(() => {
    if (!device || !config) {
      return {
        baseLabel: 'Factory Default Configuration',
        lines: [],
        addedCount: 0,
        removedCount: 0,
        sameCount: 0,
      };
    }

    let baseRsc = '';
    let baseLabel = 'Factory Default Configuration';

    if (selectedDiffTargetId !== 'factory') {
      const snap = config.backups.find((b) => b.id === selectedDiffTargetId);
      if (snap) {
        try {
          const parsedCfg = JSON.parse(snap.serializedConfig) as RouterOsDeviceConfig;
          baseRsc = RouterOsConfigService.exportRscScriptFromConfig(parsedCfg, device.modelName, false);
          baseLabel = `Snapshot: ${snap.name} (${new Date(snap.createdAt).toLocaleTimeString()})`;
        } catch {
          baseRsc = '';
        }
      }
    }

    if (!baseRsc) {
      const strippedDevice = {
        ...device,
        routerOsConfig: undefined,
        defaultGateway: undefined,
        interfaces: device.interfaces.map((i) => ({ ...i, ipAddress: undefined, pvid: 1, adminState: 'up' as const })),
      };
      const factoryCfg = RouterOsConfigService.ensureConfig(strippedDevice);
      baseRsc = RouterOsConfigService.exportRscScriptFromConfig(factoryCfg, device.modelName, false);
    }

    const lines = RouterOsConfigService.computeConfigDiff(baseRsc, runningRsc);
    const addedCount = lines.filter((l) => l.type === 'added').length;
    const removedCount = lines.filter((l) => l.type === 'removed').length;
    const sameCount = lines.filter((l) => l.type === 'same').length;

    return {
      baseLabel,
      lines,
      addedCount,
      removedCount,
      sameCount,
    };
  }, [selectedDiffTargetId, config, device, runningRsc]);

  // Filter audit logs for this device
  const deviceAuditLogs = useMemo(() => {
    if (!device) return [];
    return auditLogs.filter((log) => log.entityId === device.id);
  }, [auditLogs, device]);

  if (
    !routerConsoleState.isOpen ||
    !routerConsoleState.deviceId ||
    !device ||
    !config ||
    !hasRouterOsSupport(device, customDevices)
  ) {
    return null;
  }

  const devMetrics = deviceProcessingMetrics[device.id];
  const sysResource = RouterOsConfigService.getSystemResource(device, devMetrics?.cpuLoadPercent || 8);

  const formatBytes = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(0) + ' MB';
  };

  const handleDownloadRsc = () => {
    const blob = new Blob([runningRsc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.identity.name || device.name}-config.rsc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyRsc = () => {
    navigator.clipboard?.writeText(runningRsc);
    setCopiedRsc(true);
    setTimeout(() => setCopiedRsc(false), 2000);
  };

  const handleCreateBackup = () => {
    const defaultName = `${config.identity.name}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.backup`;
    const targetName = backupNameInput.trim() || defaultName;
    const res = mutateRouterOsConfig(device.id, `Backup: Create Snapshot (${targetName})`, (dev) =>
      RouterOsConfigService.createBackup(dev, targetName)
    );
    if (res.success) {
      setBackupNameInput('');
      setBannerMsg({ type: 'success', text: res.message || `Backup '${targetName}' created.` });
      if (res.createdId) {
        setSelectedDiffTargetId(res.createdId);
      }
    } else {
      setBannerMsg({ type: 'error', text: res.error || 'Failed to create backup.' });
    }
  };

  const handleRestoreSnapshot = (backupId: string, backupName: string) => {
    setConfirmModal({
      title: 'Restore Configuration Snapshot',
      description: `Are you sure you want to overwrite the current running configuration on ${config.identity.name} with snapshot "${backupName}"? All active interfaces, routes, and firewall rules will be synchronized immediately.`,
      confirmLabel: 'Restore Configuration',
      variant: 'amber',
      onConfirm: () => {
        const res = mutateRouterOsConfig(device.id, `Restore: Snapshot (${backupName})`, (dev) =>
          RouterOsConfigService.restoreBackup(dev, backupId)
        );
        if (res.success) {
          setBannerMsg({ type: 'success', text: res.message || `Restored from '${backupName}'.` });
        } else {
          setBannerMsg({ type: 'error', text: res.error || 'Failed to restore snapshot.' });
        }
        setConfirmModal(null);
      },
    });
  };

  const handleDeleteSnapshot = (backupId: string, backupName: string) => {
    setConfirmModal({
      title: 'Delete Backup Snapshot',
      description: `Delete backup file "${backupName}" from ${config.identity.name} storage?`,
      confirmLabel: 'Delete Snapshot',
      variant: 'rose',
      onConfirm: () => {
        const res = mutateRouterOsConfig(device.id, `Backup: Delete (${backupName})`, (dev) =>
          RouterOsConfigService.deleteBackup(dev, backupId)
        );
        if (res.success) {
          if (selectedDiffTargetId === backupId) setSelectedDiffTargetId('factory');
          setBannerMsg({ type: 'success', text: res.message || `Deleted '${backupName}'.` });
        } else {
          setBannerMsg({ type: 'error', text: res.error || 'Failed to delete snapshot.' });
        }
        setConfirmModal(null);
      },
    });
  };

  const handleResetFactory = () => {
    setConfirmModal({
      title: 'Reset to RouterOS Factory Default',
      description: `Reset ${config.identity.name} (${device.modelName}) to RouterOS factory default configuration? Saved backup files will be preserved.`,
      confirmLabel: 'Reset Configuration',
      variant: 'rose',
      onConfirm: () => {
        const res = mutateRouterOsConfig(device.id, 'Restore: Factory Default Configuration', (dev) =>
          RouterOsConfigService.resetToFactoryDefault(dev)
        );
        if (res.success) {
          setBannerMsg({ type: 'success', text: res.message || 'Reset to factory default completed.' });
        } else {
          setBannerMsg({ type: 'error', text: res.error || 'Failed to reset configuration.' });
        }
        setConfirmModal(null);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-6xl h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-800/80">
        {/* Console Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {config.identity.name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 uppercase">
                  {device.modelName}
                </span>
                <button
                  onClick={() => {
                    const nextVer = config.version === 'v7' ? 'v6' : 'v7';
                    mutateRouterOsConfig(device.id, `GUI: Switch RouterOS Profile to ${nextVer}`, (dev) =>
                      RouterOsConfigService.setRouterOsVersion(dev, nextVer)
                    );
                  }}
                  title="Click to switch RouterOS version profile (v6 <-> v7)"
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors cursor-pointer"
                >
                  RouterOS {config.version} (Switch v6/v7)
                </button>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                  UNIFIED STATE SYNCED
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5 font-sans">
                <span className="flex items-center gap-1 font-mono">
                  <Cpu className="w-3 h-3 text-cyan-400" />
                  CPU: <strong className="text-slate-200">{sysResource.cpuLoadPercent}%</strong> ({sysResource.cpuCount} Cores)
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <HardDrive className="w-3 h-3 text-emerald-400" />
                  RAM: <strong className="text-slate-200">{formatBytes(sysResource.freeMemoryBytes)} free</strong>
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Uptime: <strong className="text-slate-200">3d 14h</strong>
                </span>
                <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
                  • Modified: {new Date(config.lastModifiedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs & Actions */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('terminal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'terminal'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>CLI Terminal</span>
              </button>

              <button
                onClick={() => setActiveTab('winbox')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'winbox'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Winbox GUI</span>
              </button>

              <button
                onClick={() => setActiveTab('backup')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'backup'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Config, Diff & History</span>
                {config.backups.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-slate-950/60 text-[10px] font-mono">
                    {config.backups.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                openUserGuide(
                  activeTab === 'backup'
                    ? 'configuration-management'
                    : activeTab === 'terminal'
                    ? 'cli-reference'
                    : 'mikrotik-console'
                )
              }
              title="Panduan MikroTik Console, CLI Reference & Config Management"
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Guide</span>
            </button>

            <button
              onClick={handleDownloadRsc}
              title="Download .rsc RouterOS Script"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={closeRouterConsole}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content View Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'terminal' && (
            <RouterOsCliTerminal
              device={device}
              project={activeProject}
              mutateConfig={(actionName, fn) => mutateRouterOsConfig(device.id, actionName, fn)}
            />
          )}

          {activeTab === 'winbox' && (
            <WinboxGuiManager
              device={device}
              project={activeProject}
              mutateConfig={(actionName, fn) => mutateRouterOsConfig(device.id, actionName, fn)}
            />
          )}

          {activeTab === 'backup' && (
            <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
              {/* Sub-navigation bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-slate-900/70 border-b border-slate-800 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setConfigSubTab('rsc')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      configSubTab === 'rsc'
                        ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>Running Config (.rsc)</span>
                  </button>

                  <button
                    onClick={() => setConfigSubTab('snapshots')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      configSubTab === 'snapshots'
                        ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Backup & Restore ({config.backups.length})</span>
                  </button>

                  <button
                    onClick={() => setConfigSubTab('diff')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      configSubTab === 'diff'
                        ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Configuration Diff</span>
                    {(diffResult.addedCount > 0 || diffResult.removedCount > 0) && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                        +{diffResult.addedCount} / -{diffResult.removedCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setConfigSubTab('history')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      configSubTab === 'history'
                        ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Change History & Audit ({deviceAuditLogs.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      setConfigSubTab('test-suite');
                      if (!testSuiteReport) {
                        setTestSuiteReport(RouterOsVerificationSuite.runFullSuite(device, activeProject));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      configSubTab === 'test-suite'
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>12-Scenario Test Suite</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRsc}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                  >
                    {copiedRsc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedRsc ? 'Copied!' : 'Copy .rsc'}</span>
                  </button>

                  <button
                    onClick={handleDownloadRsc}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export .rsc</span>
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              {bannerMsg && (
                <div
                  className={`mx-6 mt-4 px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    bannerMsg.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-700/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{bannerMsg.text}</span>
                  </div>
                  <button onClick={() => setBannerMsg(null)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Sub-tab 1: Running Config (.rsc) */}
              {configSubTab === 'rsc' && (
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-400">
                      Live RouterOS Running Configuration — Synchronized across CLI Terminal, Winbox GUI & Topology Canvas
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {runningRsc.split('\n').length} lines • {new Blob([runningRsc]).size} bytes
                    </span>
                  </div>
                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto">
                    <pre className="text-xs font-mono text-cyan-300 whitespace-pre-wrap select-text leading-relaxed">
                      {runningRsc}
                    </pre>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Backup & Restore Snapshots */}
              {configSubTab === 'snapshots' && (
                <div className="flex-1 flex flex-col p-6 space-y-5 overflow-y-auto">
                  {/* Create Backup Bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                        Create Configuration Backup Snapshot
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Captures complete device state (Interfaces, Bridge/VLAN, IPs, Routes, DHCP/DNS, Firewall/NAT, Queues). Also accessible via CLI: <code className="text-cyan-400 font-mono">/system backup save name=...</code>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        value={backupNameInput}
                        onChange={(e) => setBackupNameInput(e.target.value)}
                        placeholder={`${config.identity.name}-snapshot.backup`}
                        className="flex-1 sm:w-64 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={handleCreateBackup}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Snapshot</span>
                      </button>
                      <button
                        onClick={handleResetFactory}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                        title="Reset running configuration to factory default"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset Default</span>
                      </button>
                    </div>
                  </div>

                  {/* Snapshots Table */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">Saved Snapshots in Flash Storage</span>
                      <span className="text-[11px] font-mono text-slate-400">{config.backups.length} file(s)</span>
                    </div>

                    {config.backups.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No backup snapshots saved yet. Click <strong>Create Snapshot</strong> above or run{' '}
                        <code className="text-cyan-400 font-mono">/system backup save</code> in the CLI Terminal.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400 bg-slate-950/40">
                              <th className="py-2.5 px-4">Snapshot Name</th>
                              <th className="py-2.5 px-4">RouterOS</th>
                              <th className="py-2.5 px-4">Size</th>
                              <th className="py-2.5 px-4">Created At</th>
                              <th className="py-2.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {config.backups.map((b) => (
                              <tr key={b.id} className="hover:bg-slate-800/40">
                                <td className="py-2.5 px-4 font-semibold text-cyan-300">{b.name}</td>
                                <td className="py-2.5 px-4 text-slate-300">{b.routerOsVersion}</td>
                                <td className="py-2.5 px-4 text-slate-400">{b.sizeBytes} B</td>
                                <td className="py-2.5 px-4 text-slate-400">
                                  {new Date(b.createdAt).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSelectedDiffTargetId(b.id);
                                        setConfigSubTab('diff');
                                      }}
                                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-medium flex items-center gap-1 border border-slate-700"
                                    >
                                      <GitCompare className="w-3 h-3 text-cyan-400" />
                                      <span>Diff</span>
                                    </button>
                                    <button
                                      onClick={() => handleRestoreSnapshot(b.id, b.name)}
                                      className="px-2.5 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[11px] font-sans font-semibold flex items-center gap-1"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      <span>Restore</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSnapshot(b.id, b.name)}
                                      className="p-1 rounded bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 border border-rose-800/50"
                                      title="Delete Snapshot"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Configuration Diff Viewer */}
              {configSubTab === 'diff' && (
                <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-300">Compare Running Config Against:</span>
                      <select
                        value={selectedDiffTargetId}
                        onChange={(e) => setSelectedDiffTargetId(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      >
                        <option value="factory">Factory Default Configuration</option>
                        {config.backups.map((b) => (
                          <option key={b.id} value={b.id}>
                            Snapshot: {b.name} ({new Date(b.createdAt).toLocaleTimeString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                        +{diffResult.addedCount} Added
                      </span>
                      <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-700/60 text-rose-300">
                        -{diffResult.removedCount} Removed
                      </span>
                      <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300">
                        {diffResult.sameCount} Unchanged
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto font-mono text-xs space-y-0.5">
                    {diffResult.addedCount === 0 && diffResult.removedCount === 0 && (
                      <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs">
                        Running configuration is identical to {diffResult.baseLabel}.
                      </div>
                    )}
                    {diffResult.lines.map((item, idx) => (
                      <div
                        key={idx}
                        className={`px-2.5 py-0.5 rounded whitespace-pre-wrap ${
                          item.type === 'added'
                            ? 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-400'
                            : item.type === 'removed'
                            ? 'bg-rose-950/60 text-rose-300 border-l-2 border-rose-400 line-through opacity-80'
                            : 'text-slate-400'
                        }`}
                      >
                        <span className="inline-block w-5 select-none font-bold">
                          {item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' '}
                        </span>
                        {item.line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Change History & Audit Log */}
              {configSubTab === 'history' && (
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                        Device Configuration Audit Trail ({config.identity.name})
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Every CLI command and Winbox GUI form mutation is validated, applied to the unified state, and recorded here.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      {deviceAuditLogs.length} recorded change(s)
                    </span>
                  </div>

                  <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-y-auto">
                    {deviceAuditLogs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No configuration changes recorded yet for {config.identity.name} in this session. Try adding an IP or route via CLI or Winbox GUI.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-[10px] font-mono uppercase text-slate-400 bg-slate-950/50 sticky top-0">
                            <th className="py-2.5 px-4">Timestamp</th>
                            <th className="py-2.5 px-4">Source</th>
                            <th className="py-2.5 px-4">Actor</th>
                            <th className="py-2.5 px-4">Operation</th>
                            <th className="py-2.5 px-4">Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {deviceAuditLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-800/40">
                              <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="py-2.5 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    log.source === 'cli'
                                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                                      : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                                  }`}
                                >
                                  {log.source === 'cli' ? 'CLI' : 'WINBOX GUI'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-300">{log.actor}</td>
                              <td className="py-2.5 px-4 font-semibold text-white">{log.action}</td>
                              <td className="py-2.5 px-4 text-slate-300 font-sans">{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 5: 12-Scenario Verification & Regression Suite */}
              {configSubTab === 'test-suite' && (
                <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shrink-0">
                    <div>
                      <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>RouterOS Console & Simulation Engine — 12-Scenario Verification Suite</span>
                      </h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Executes all 12 end-to-end verification tests (CLI, Winbox GUI, Two-Way Sync, VLAN/Bridge, Static Routing, Invalid Commands, RouterOS 6 vs 7 Compatibility, Packet Tracer Firewall Integration, and Regression Checks) in an isolated device sandbox.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {testSuiteReport && (
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-700/60 text-emerald-300 font-bold">
                            {testSuiteReport.passedTests}/{testSuiteReport.totalTests} PASSED
                          </span>
                          {testSuiteReport.failedTests > 0 && (
                            <span className="px-2.5 py-1 rounded bg-rose-950/90 border border-rose-700/60 text-rose-300 font-bold">
                              {testSuiteReport.failedTests} FAILED
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() =>
                          setTestSuiteReport(RouterOsVerificationSuite.runFullSuite(device, activeProject))
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Re-Run 12 Scenarios</span>
                      </button>
                    </div>
                  </div>

                  {testSuiteReport && (
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-y-auto divide-y divide-slate-800/70">
                      {testSuiteReport.results.map((tc) => (
                        <div key={tc.id} className="p-3.5 hover:bg-slate-800/30 transition-colors space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                                  tc.passed
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                    : 'bg-rose-950 text-rose-300 border border-rose-700/60'
                                }`}
                              >
                                {tc.passed ? 'PASS' : 'FAIL'}
                              </span>
                              <span className="text-xs font-bold text-white">{tc.title}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-mono text-cyan-300">
                                {tc.category}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{tc.durationMs}ms</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-2.5 py-1.5 font-mono text-cyan-300">
                              <span className="text-slate-500 select-none">Action: </span>
                              {tc.commandOrAction}
                            </div>
                            <div className="bg-slate-950/70 border border-slate-800/80 rounded px-2.5 py-1.5 font-mono text-emerald-300">
                              <span className="text-slate-500 select-none">Evidence: </span>
                              {tc.actualEvidence}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Inline Confirmation Modal (No window.confirm) */}
          {confirmModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
              <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      confirmModal.variant === 'rose'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{confirmModal.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{confirmModal.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className={`px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold ${
                      confirmModal.variant === 'rose'
                        ? 'bg-rose-600 hover:bg-rose-500'
                        : 'bg-amber-600 hover:bg-amber-500'
                    }`}
                  >
                    {confirmModal.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
