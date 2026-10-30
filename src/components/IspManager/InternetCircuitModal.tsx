import React, { useState } from 'react';
import {
  InternetCircuit,
  IspProvider,
  BandwidthUnit,
  CircuitServiceType,
  CircuitConnectionStatus,
} from '../../types/network';
import {
  Network,
  X,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  DollarSign,
  Activity,
  ShieldCheck,
  Star,
} from 'lucide-react';

interface InternetCircuitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (circuit: Omit<InternetCircuit, 'id' | 'createdAt' | 'updatedAt'>) => void;
  providers: IspProvider[];
  initialData?: InternetCircuit | null;
}

const SERVICE_TYPES: { type: CircuitServiceType; label: string; desc: string }[] = [
  { type: 'dedicated', label: 'Dedicated Internet Access (DIA)', desc: '1:1 CIR guaranteed enterprise pipe' },
  { type: 'shared', label: 'Shared Corporate Broadband', desc: 'Over-subscribed pipe with minimum CIR guarantee' },
  { type: 'broadband', label: 'Standard FTTH Broadband', desc: 'High downstream, limited upload consumer line' },
  { type: 'best-effort', label: 'Best Effort Transit', desc: 'No CIR guarantee; throughput depends on network load' },
  { type: 'metro-ethernet', label: 'Metro-E L2/L3 Carrier Link', desc: 'Point-to-point trunk to upstream PoP' },
  { type: 'private-wan', label: 'Private WAN / MPLS', desc: 'Inter-branch corporate private link' },
  { type: 'satellite', label: 'Satellite LEO Constellation', desc: 'Low Earth Orbit or VSAT backup link' },
];

const CONTENTION_PRESETS = ['1:1', '1:2', '1:4', '1:8', '1:10', 'custom'];

// Helper to convert rate to Mbps for comparisons
function toMbps(val: number, unit: BandwidthUnit): number {
  if (unit === 'Gbps') return val * 1000;
  if (unit === 'Kbps') return val / 1000;
  return val;
}

export const InternetCircuitModal: React.FC<InternetCircuitModalProps> = ({
  isOpen,
  onClose,
  onSave,
  providers,
  initialData,
}) => {
  const [ispProviderId, setIspProviderId] = useState(
    initialData?.ispProviderId || (providers[0]?.id || '')
  );
  const [circuitName, setCircuitName] = useState(initialData?.circuitName || '');
  const [serviceType, setServiceType] = useState<CircuitServiceType>(
    initialData?.serviceType || 'dedicated'
  );

  // Bandwidths
  const [downloadBandwidth, setDownloadBandwidth] = useState<number>(
    initialData?.downloadBandwidth ?? 100
  );
  const [downloadUnit, setDownloadUnit] = useState<BandwidthUnit>(
    initialData?.downloadUnit || 'Mbps'
  );
  const [uploadBandwidth, setUploadBandwidth] = useState<number>(
    initialData?.uploadBandwidth ?? 100
  );
  const [uploadUnit, setUploadUnit] = useState<BandwidthUnit>(
    initialData?.uploadUnit || 'Mbps'
  );

  // CIR (Committed Information Rate)
  const [hasCir, setHasCir] = useState<boolean>(
    initialData?.downloadCir !== undefined && initialData?.downloadCir > 0
  );
  const [downloadCir, setDownloadCir] = useState<number>(
    initialData?.downloadCir ?? 100
  );
  const [downloadCirUnit, setDownloadCirUnit] = useState<BandwidthUnit>(
    initialData?.downloadCirUnit || 'Mbps'
  );
  const [uploadCir, setUploadCir] = useState<number>(
    initialData?.uploadCir ?? 100
  );
  const [uploadCirUnit, setUploadCirUnit] = useState<BandwidthUnit>(
    initialData?.uploadCirUnit || 'Mbps'
  );

  // MIR (Maximum Information Rate / Peak Burst)
  const [hasMir, setHasMir] = useState<boolean>(initialData?.downloadMir !== undefined);
  const [downloadMir, setDownloadMir] = useState<number>(initialData?.downloadMir ?? 120);
  const [downloadMirUnit, setDownloadMirUnit] = useState<BandwidthUnit>(
    initialData?.downloadMirUnit || 'Mbps'
  );
  const [uploadMir, setUploadMir] = useState<number>(initialData?.uploadMir ?? 120);
  const [uploadMirUnit, setUploadMirUnit] = useState<BandwidthUnit>(
    initialData?.uploadMirUnit || 'Mbps'
  );

  // Contention Ratio
  const [contentionRatio, setContentionRatio] = useState<string>(
    initialData?.contentionRatio || '1:1'
  );
  const [customRatio, setCustomRatio] = useState<string>('1:16');

  // Performance SLA
  const [latencyMs, setLatencyMs] = useState<number>(initialData?.latencyMs ?? 5);
  const [jitterMs, setJitterMs] = useState<number>(initialData?.jitterMs ?? 1);
  const [packetLossPercent, setPacketLossPercent] = useState<number>(
    initialData?.packetLossPercent ?? 0
  );
  const [slaPercent, setSlaPercent] = useState<number>(initialData?.slaPercent ?? 99.5);

  // IP Addressing
  const [publicIp, setPublicIp] = useState(initialData?.publicIp || '');
  const [gatewayIp, setGatewayIp] = useState(initialData?.gatewayIp || '');
  const [subnetMask, setSubnetMask] = useState(initialData?.subnetMask || '255.255.255.252');
  const [dnsServers, setDnsServers] = useState(
    initialData?.dnsServers?.join(', ') || '8.8.8.8, 1.1.1.1'
  );

  // Contract & Cost
  const [monthlyCost, setMonthlyCost] = useState<number>(initialData?.monthlyCost ?? 5000000);
  const [currency, setCurrency] = useState(initialData?.currency || 'IDR');
  const [contractStart, setContractStart] = useState(initialData?.contractStart || '');
  const [contractEnd, setContractEnd] = useState(initialData?.contractEnd || '');

  // Status & Priority
  const [isPrimaryWan, setIsPrimaryWan] = useState(initialData?.isPrimaryWan ?? false);
  const [status, setStatus] = useState<CircuitConnectionStatus>(
    initialData?.status || 'active'
  );

  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Real-time CIR validation check: CIR cannot exceed Nominal Bandwidth
  const downBwMbps = toMbps(downloadBandwidth, downloadUnit);
  const downCirMbps = hasCir ? toMbps(downloadCir, downloadCirUnit) : 0;
  const isDownCirInvalid = downCirMbps > downBwMbps;

  const upBwMbps = toMbps(uploadBandwidth, uploadUnit);
  const upCirMbps = hasCir ? toMbps(uploadCir, uploadCirUnit) : 0;
  const isUpCirInvalid = upCirMbps > upBwMbps;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!circuitName.trim()) {
      setError('Circuit Name is required.');
      return;
    }
    if (!ispProviderId) {
      setError('Please select an ISP Provider.');
      return;
    }
    if (downloadBandwidth <= 0 || uploadBandwidth <= 0) {
      setError('Bandwidth values must be positive.');
      return;
    }

    if (hasCir && (isDownCirInvalid || isUpCirInvalid)) {
      setError('CIR (Committed Information Rate) cannot exceed the nominal service bandwidth capacity!');
      return;
    }

    const ratio = contentionRatio === 'custom' ? customRatio : contentionRatio;

    onSave({
      ispProviderId,
      circuitName: circuitName.trim(),
      serviceType,
      downloadBandwidth,
      downloadUnit,
      uploadBandwidth,
      uploadUnit,
      downloadCir: hasCir ? downloadCir : undefined,
      downloadCirUnit: hasCir ? downloadCirUnit : undefined,
      uploadCir: hasCir ? uploadCir : undefined,
      uploadCirUnit: hasCir ? uploadCirUnit : undefined,
      downloadMir: hasMir ? downloadMir : undefined,
      downloadMirUnit: hasMir ? downloadMirUnit : undefined,
      uploadMir: hasMir ? uploadMir : undefined,
      uploadMirUnit: hasMir ? uploadMirUnit : undefined,
      contentionRatio: ratio,
      latencyMs,
      jitterMs,
      packetLossPercent,
      slaPercent,
      publicIp: publicIp.trim() || undefined,
      gatewayIp: gatewayIp.trim() || undefined,
      subnetMask: subnetMask.trim() || undefined,
      dnsServers: dnsServers
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      monthlyCost,
      currency,
      contractStart: contractStart || undefined,
      contractEnd: contractEnd || undefined,
      isPrimaryWan,
      status,
      cpeDeviceId: initialData?.cpeDeviceId,
      cpeWanInterfaceId: initialData?.cpeWanInterfaceId,
      cpeLanInterfaceId: initialData?.cpeLanInterfaceId,
      targetRouterDeviceId: initialData?.targetRouterDeviceId,
      targetRouterInterfaceId: initialData?.targetRouterInterfaceId,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {initialData ? 'Edit Internet Circuit' : 'Provision New Internet Circuit'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Configure download/upload bandwidth, committed rates (CIR), contention, and SLA terms.
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Section 1: Provider & Identification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Upstream ISP Provider <span className="text-rose-400">*</span>
              </label>
              <select
                value={ispProviderId}
                onChange={(e) => setIspProviderId(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                required
              >
                {providers.length === 0 ? (
                  <option value="">No Providers Available (Add provider first)</option>
                ) : (
                  providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Circuit Name / ID <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={circuitName}
                onChange={(e) => {
                  setCircuitName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Astinet DIA 300M, Biznet Dedicated 500M"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Service Type</label>
            <select
              value={serviceType}
              onChange={(e) => {
                const newType = e.target.value as CircuitServiceType;
                setServiceType(newType);
                if (newType === 'dedicated') {
                  setContentionRatio('1:1');
                  setHasCir(true);
                  setDownloadCir(downloadBandwidth);
                  setUploadCir(uploadBandwidth);
                } else if (newType === 'best-effort') {
                  setHasCir(false);
                }
              }}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              {SERVICE_TYPES.map((st) => (
                <option key={st.type} value={st.type}>
                  {st.label} — {st.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Section 2: Bandwidth Download & Upload (Separated) */}
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nominal Bandwidth (Separated Down/Up)</span>
              </span>
              <span className="text-[10px] text-slate-400">Layer 3 Rate Limit Contract</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Download Bandwidth */}
              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Download Bandwidth (↓)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={downloadBandwidth}
                    onChange={(e) => setDownloadBandwidth(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                    required
                  />
                  <select
                    value={downloadUnit}
                    onChange={(e) => setDownloadUnit(e.target.value as BandwidthUnit)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white font-mono text-[11px]"
                  >
                    <option value="Mbps">Mbps</option>
                    <option value="Gbps">Gbps</option>
                    <option value="Kbps">Kbps</option>
                  </select>
                </div>
              </div>

              {/* Upload Bandwidth */}
              <div>
                <label className="block text-slate-400 text-[11px] font-medium mb-1">
                  Upload Bandwidth (↑)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={uploadBandwidth}
                    onChange={(e) => setUploadBandwidth(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                    required
                  />
                  <select
                    value={uploadUnit}
                    onChange={(e) => setUploadUnit(e.target.value as BandwidthUnit)}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white font-mono text-[11px]"
                  >
                    <option value="Mbps">Mbps</option>
                    <option value="Gbps">Gbps</option>
                    <option value="Kbps">Kbps</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Committed Information Rate (CIR) */}
          <div className="p-3.5 rounded-lg bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCir}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setHasCir(checked);
                    if (checked) {
                      setDownloadCir(downloadBandwidth);
                      setUploadCir(uploadBandwidth);
                    }
                  }}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 w-3.5 h-3.5"
                />
                <span className="font-bold text-white text-xs">
                  Enable CIR Guarantee (Committed Information Rate)
                </span>
              </label>
              <span className="text-[10px] text-emerald-400 font-mono">
                {hasCir ? 'SLA Enforced' : 'Best Effort'}
              </span>
            </div>

            {hasCir && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] font-medium mb-1">
                      Download CIR Guarantee (↓)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={downloadCir}
                        onChange={(e) => setDownloadCir(parseFloat(e.target.value) || 0)}
                        className={`w-full bg-slate-800 border rounded px-2.5 py-1.5 text-white font-mono ${
                          isDownCirInvalid ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700'
                        }`}
                      />
                      <select
                        value={downloadCirUnit}
                        onChange={(e) => setDownloadCirUnit(e.target.value as BandwidthUnit)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white font-mono text-[11px]"
                      >
                        <option value="Mbps">Mbps</option>
                        <option value="Gbps">Gbps</option>
                        <option value="Kbps">Kbps</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] font-medium mb-1">
                      Upload CIR Guarantee (↑)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={uploadCir}
                        onChange={(e) => setUploadCir(parseFloat(e.target.value) || 0)}
                        className={`w-full bg-slate-800 border rounded px-2.5 py-1.5 text-white font-mono ${
                          isUpCirInvalid ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700'
                        }`}
                      />
                      <select
                        value={uploadCirUnit}
                        onChange={(e) => setUploadCirUnit(e.target.value as BandwidthUnit)}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white font-mono text-[11px]"
                      >
                        <option value="Mbps">Mbps</option>
                        <option value="Gbps">Gbps</option>
                        <option value="Kbps">Kbps</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Validation Banner if CIR > Bandwidth */}
                {(isDownCirInvalid || isUpCirInvalid) && (
                  <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>
                      Validation Warning: CIR guarantee ({downloadCir} {downloadCirUnit} ↓ / {uploadCir} {uploadCirUnit} ↑)
                      cannot exceed nominal line bandwidth ({downloadBandwidth} {downloadUnit} ↓ / {uploadBandwidth} {uploadUnit} ↑)!
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Contention Ratio & MIR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Contention Ratio</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {CONTENTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setContentionRatio(preset)}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                      contentionRatio === preset
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                        : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {preset === '1:1' ? '1:1 (Dedicated)' : preset}
                  </button>
                ))}
              </div>
              {contentionRatio === 'custom' && (
                <input
                  type="text"
                  value={customRatio}
                  onChange={(e) => setCustomRatio(e.target.value)}
                  placeholder="e.g. 1:16 or 1:20"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                />
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">SLA Target & Quality</label>
                <span className="text-[10px] text-cyan-400 font-mono">{slaPercent}% SLA</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Latency</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={latencyMs}
                    onChange={(e) => setLatencyMs(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                    placeholder="ms"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Jitter</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={jitterMs}
                    onChange={(e) => setJitterMs(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                    placeholder="ms"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Loss %</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={packetLossPercent}
                    onChange={(e) => setPacketLossPercent(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono text-[11px]"
                    placeholder="%"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Public IP & Gateway */}
          <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-800 space-y-2.5">
            <span className="font-bold text-white text-xs block">Public Addressing & Route Parameters</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-[11px]">
              <div>
                <label className="text-slate-400 block mb-1">Public WAN IP</label>
                <input
                  type="text"
                  value={publicIp}
                  onChange={(e) => setPublicIp(e.target.value)}
                  placeholder="e.g. 103.144.20.2"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Upstream Gateway</label>
                <input
                  type="text"
                  value={gatewayIp}
                  onChange={(e) => setGatewayIp(e.target.value)}
                  placeholder="e.g. 103.144.20.1"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Subnet Mask</label>
                <input
                  type="text"
                  value={subnetMask}
                  onChange={(e) => setSubnetMask(e.target.value)}
                  placeholder="255.255.255.252"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 block mb-1 text-[11px]">DNS Resolvers (comma-separated)</label>
              <input
                type="text"
                value={dnsServers}
                onChange={(e) => setDnsServers(e.target.value)}
                placeholder="202.134.0.155, 8.8.8.8, 1.1.1.1"
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Section 6: Contract Cost & WAN Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
            <div className="flex items-center gap-2">
              <div className="w-full">
                <label className="block text-slate-400 text-[11px] mb-1">Monthly Cost ({currency})</label>
                <input
                  type="number"
                  min="0"
                  step="100000"
                  value={monthlyCost}
                  onChange={(e) => setMonthlyCost(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono text-xs"
                />
              </div>
              <div className="w-24">
                <label className="block text-slate-400 text-[11px] mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Primary WAN Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <Star className={`w-4 h-4 ${isPrimaryWan ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-white font-bold block text-xs">Primary WAN Gateway</span>
                  <span className="text-[10px] text-slate-400">Default internet route (0.0.0.0/0)</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPrimaryWan}
                onChange={(e) => setIsPrimaryWan(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
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
              <span>{initialData ? 'Update Circuit' : 'Provision Circuit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
