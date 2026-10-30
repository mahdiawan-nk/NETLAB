import React, { useState, useEffect } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  InternetCircuit,
  CpeConnectionMode,
  CpeIpMode,
} from '../../types/network';
import {
  Cable,
  X,
  Router,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Globe,
  Plus,
  ShieldCheck,
  Server,
} from 'lucide-react';

interface CpeWanMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  circuit: InternetCircuit | null;
}

export const CpeWanMappingModal: React.FC<CpeWanMappingModalProps> = ({
  isOpen,
  onClose,
  circuit,
}) => {
  const {
    activeProject,
    assignCpeToCircuit,
    unassignCpeFromCircuit,
    addDevice,
  } = useNetworkStore();

  const providers = activeProject.ispProviders || [];
  const provider = providers.find((p) => p.id === circuit?.ispProviderId);

  // Available candidate CPE devices (wan, modem, ont, isp-gateway, or other devices)
  const candidateCpeDevices = activeProject.devices.filter(
    (d) =>
      d.category === 'wan' ||
      d.category === 'endpoint' ||
      d.modelId.includes('modem') ||
      d.modelId.includes('ont') ||
      d.modelId.includes('isp') ||
      d.name.toLowerCase().includes('isp') ||
      d.name.toLowerCase().includes('modem') ||
      d.name.toLowerCase().includes('ont')
  );

  // Fallback to all devices if no specific WAN category found
  const cpeDevices = candidateCpeDevices.length > 0 ? candidateCpeDevices : activeProject.devices;

  // Candidate routers (category: router, switch, or firewall)
  const routerDevices = activeProject.devices.filter(
    (d) => d.category === 'router' || d.category === 'switch' || d.category === 'server'
  );

  // Form states
  const [selectedCpeId, setSelectedCpeId] = useState<string>('');
  const [wanInterfaceId, setWanInterfaceId] = useState<string>('');
  const [lanInterfaceId, setLanInterfaceId] = useState<string>('');
  const [connectionMode, setConnectionMode] = useState<CpeConnectionMode>('bridge');
  const [ipMode, setIpMode] = useState<CpeIpMode>('static');
  const [pppoeUsername, setPppoeUsername] = useState<string>('');
  const [pppoePassword, setPppoePassword] = useState<string>('');
  const [managementIp, setManagementIp] = useState<string>('192.168.100.1');

  // Target router states
  const [targetRouterId, setTargetRouterId] = useState<string>('');
  const [targetRouterInterfaceId, setTargetRouterInterfaceId] = useState<string>('');
  const [autoCreateLink, setAutoCreateLink] = useState<boolean>(true);

  const [error, setError] = useState<string | null>(null);

  // Prepopulate form when modal opens
  useEffect(() => {
    if (!isOpen || !circuit) return;

    // Check existing assignment
    const existing = (activeProject.cpeAssignments || []).find((a) => a.circuitId === circuit.id);

    if (existing) {
      setSelectedCpeId(existing.cpeDeviceId);
      setWanInterfaceId(existing.wanInterfaceId || '');
      setLanInterfaceId(existing.lanInterfaceId || '');
      setConnectionMode(existing.connectionMode);
      setIpMode(existing.ipMode);
      setPppoeUsername(existing.pppoeUsername || '');
      setPppoePassword(existing.pppoePassword || '');
      setManagementIp(existing.managementIp || '192.168.100.1');
    } else if (circuit.cpeDeviceId) {
      setSelectedCpeId(circuit.cpeDeviceId);
      setWanInterfaceId(circuit.cpeWanInterfaceId || '');
      setLanInterfaceId(circuit.cpeLanInterfaceId || '');
    } else {
      // Default to first CPE device
      const defaultCpe = cpeDevices[0];
      if (defaultCpe) {
        setSelectedCpeId(defaultCpe.id);
        setWanInterfaceId(defaultCpe.interfaces[0]?.id || '');
        setLanInterfaceId(defaultCpe.interfaces[1]?.id || defaultCpe.interfaces[0]?.id || '');
      }
    }

    if (circuit.targetRouterDeviceId) {
      setTargetRouterId(circuit.targetRouterDeviceId);
      setTargetRouterInterfaceId(circuit.targetRouterInterfaceId || '');
    } else {
      const defaultRouter = routerDevices[0];
      if (defaultRouter) {
        setTargetRouterId(defaultRouter.id);
        const wanPort = defaultRouter.interfaces.find((i) => i.mode === 'wan') || defaultRouter.interfaces[0];
        setTargetRouterInterfaceId(wanPort?.id || '');
      }
    }
  }, [isOpen, circuit?.id]);

  if (!isOpen || !circuit) return null;

  const currentCpe = activeProject.devices.find((d) => d.id === selectedCpeId);
  const currentRouter = activeProject.devices.find((d) => d.id === targetRouterId);

  // Deploy new Modem device onto canvas
  const handleDeployNewModem = () => {
    const newModem = addDevice(
      'wan-isp-dedicated-fiber',
      `MODEM-${circuit.circuitName.slice(0, 10).toUpperCase().replace(/\s+/g, '-')}`,
      Math.round(250 + Math.random() * 80),
      Math.round(60 + Math.random() * 40)
    );
    if (newModem) {
      setSelectedCpeId(newModem.id);
      setWanInterfaceId(newModem.interfaces[0]?.id || '');
      setLanInterfaceId(newModem.interfaces[1]?.id || newModem.interfaces[0]?.id || '');
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCpeId) {
      setError('Please select a Modem/ONT device.');
      return;
    }
    if (!currentCpe) {
      setError('Selected CPE device was not found in project.');
      return;
    }

    assignCpeToCircuit(
      circuit.id,
      {
        cpeDeviceId: selectedCpeId,
        deviceModel: currentCpe.modelName || 'Fiber ONT / Modem',
        deviceCategory: (currentCpe.category as any) || 'ont',
        managementIp,
        wanInterfaceId: wanInterfaceId || undefined,
        lanInterfaceId: lanInterfaceId || undefined,
        connectionMode,
        ipMode,
        pppoeUsername: ipMode === 'pppoe' ? pppoeUsername : undefined,
        pppoePassword: ipMode === 'pppoe' ? pppoePassword : undefined,
        notes: `Terminates ${circuit.circuitName} on ${currentCpe.name}`,
      },
      targetRouterId && targetRouterInterfaceId
        ? { deviceId: targetRouterId, interfaceId: targetRouterInterfaceId }
        : undefined,
      autoCreateLink
    );

    onClose();
  };

  const handleUnassign = () => {
    unassignCpeFromCircuit(circuit.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Cable className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Map CPE Modem & Router WAN Interface
              </h3>
              <p className="text-[11px] text-slate-400">
                Establish topology termination: ISP Provider → Internet Circuit → Modem/ONT → Router WAN.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleApply} className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Circuit Banner */}
          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 flex items-center justify-between font-mono">
            <div>
              <span className="text-[10px] text-cyan-400 block font-sans uppercase font-bold">Target Circuit</span>
              <span className="font-bold text-white text-xs">{circuit.circuitName}</span>
              <span className="text-[11px] text-slate-400 block">
                Provider: {provider?.name || 'ISP'} · Bandwidth: {circuit.downloadBandwidth}{circuit.downloadUnit} ↓ / {circuit.uploadBandwidth}{circuit.uploadUnit} ↑
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-sans">Public IP Assigned</span>
              <span className="text-emerald-400 font-bold text-xs">{circuit.publicIp || 'Dynamic DHCP'}</span>
            </div>
          </div>

          {/* STEP 1: MODEM / ONT / CPE SELECTION */}
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>1. Physical Modem / ONT / CPE Device</span>
              </div>
              <button
                type="button"
                onClick={handleDeployNewModem}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-[10px] font-mono flex items-center gap-1 border border-slate-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Deploy New Modem to Canvas</span>
              </button>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">
                Select CPE Device in Topology
              </label>
              <select
                value={selectedCpeId}
                onChange={(e) => {
                  setSelectedCpeId(e.target.value);
                  const dev = activeProject.devices.find((d) => d.id === e.target.value);
                  if (dev) {
                    setWanInterfaceId(dev.interfaces[0]?.id || '');
                    setLanInterfaceId(dev.interfaces[1]?.id || dev.interfaces[0]?.id || '');
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                required
              >
                {cpeDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.modelName}) — [{d.category.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {currentCpe && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">CPE WAN Uplink Interface (Optical/DSL/Coax)</label>
                  <select
                    value={wanInterfaceId}
                    onChange={(e) => setWanInterfaceId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  >
                    {currentCpe.interfaces.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">CPE LAN Output Interface (To Router)</label>
                  <select
                    value={lanInterfaceId}
                    onChange={(e) => setLanInterfaceId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  >
                    {currentCpe.interfaces.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: CONNECTION & IP MODE */}
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. Operation Mode & IP Protocol</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Connection Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConnectionMode('bridge')}
                    className={`py-1.5 px-2 rounded text-center text-xs font-semibold transition-colors ${
                      connectionMode === 'bridge'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Bridge Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnectionMode('router')}
                    className={`py-1.5 px-2 rounded text-center text-xs font-semibold transition-colors ${
                      connectionMode === 'router'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Router Mode
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  {connectionMode === 'bridge'
                    ? 'Layer 2 transparent pass-through; public IP terminates on router.'
                    : 'CPE performs NAT & DHCP routing; router receives private IP.'}
                </span>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">WAN IP Mode</label>
                <select
                  value={ipMode}
                  onChange={(e) => setIpMode(e.target.value as CpeIpMode)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs"
                >
                  <option value="static">Static IP / Manual Addressing</option>
                  <option value="dhcp">DHCP Client (Dynamic IP)</option>
                  <option value="pppoe">PPPoE Client Authentication</option>
                </select>
              </div>
            </div>

            {/* PPPoE Credentials if selected */}
            {ipMode === 'pppoe' && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">PPPoE Username</label>
                  <input
                    type="text"
                    value={pppoeUsername}
                    onChange={(e) => setPppoeUsername(e.target.value)}
                    placeholder="user@telkom.net"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">PPPoE Password</label>
                  <input
                    type="password"
                    value={pppoePassword}
                    onChange={(e) => setPppoePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-400 text-[10px] mb-1">CPE Web Management IP</label>
              <input
                type="text"
                value={managementIp}
                onChange={(e) => setManagementIp(e.target.value)}
                placeholder="192.168.100.1"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-[11px]"
              />
            </div>
          </div>

          {/* STEP 3: TARGET ROUTER WAN TERMINATION */}
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <Router className="w-3.5 h-3.5 text-cyan-400" />
              <span>3. Target Router WAN Interface Termination</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Core / Edge Router</label>
                <select
                  value={targetRouterId}
                  onChange={(e) => {
                    setTargetRouterId(e.target.value);
                    const dev = activeProject.devices.find((d) => d.id === e.target.value);
                    if (dev) {
                      const wanPort = dev.interfaces.find((i) => i.mode === 'wan') || dev.interfaces[0];
                      setTargetRouterInterfaceId(wanPort?.id || '');
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                >
                  <option value="">-- No Router Linked --</option>
                  {routerDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.modelName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Router WAN Port</label>
                <select
                  value={targetRouterInterfaceId}
                  onChange={(e) => setTargetRouterInterfaceId(e.target.value)}
                  disabled={!targetRouterId}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs disabled:opacity-50"
                >
                  {currentRouter?.interfaces.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.type}) {i.mode === 'wan' ? '[WAN]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Auto-create link option */}
            <div className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
              <div>
                <span className="text-white font-medium block text-[11px]">Auto-connect Physical Cable Link</span>
                <span className="text-[10px] text-slate-400">
                  Automatically establishes Cat6 Ethernet cable from Modem LAN to Router WAN port on topology canvas.
                </span>
              </div>
              <input
                type="checkbox"
                checked={autoCreateLink}
                onChange={(e) => setAutoCreateLink(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-4 h-4"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            {circuit.cpeDeviceId ? (
              <button
                type="button"
                onClick={handleUnassign}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-medium transition-colors"
              >
                Unassign CPE Mapping
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply & Map to Topology</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
