import React, { useState, useEffect } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  UnifiedCatalogDevice,
  UnifiedDeviceCategory,
  VerificationStatus,
  InterfaceType,
  InterfaceSpeed,
  InterfaceCategory,
  ConnectorType,
  MediaType,
  UnifiedPortSpec,
  SourceReference,
} from '../../types/network';
import { createDefaultCustomDevice } from '../../services/deviceAdapter';
import {
  X,
  Sparkles,
  Server,
  Cpu,
  Layers,
  LayoutGrid,
  CheckCircle2,
  Gauge,
  Zap,
  Wifi,
  ShieldCheck,
  Plus,
  Trash2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Save,
  Copy,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const CustomDeviceWizardModal: React.FC = () => {
  const {
    isDeviceBuilderOpen,
    editingCustomDevice,
    closeDeviceBuilder,
    saveCustomDevice,
  } = useNetworkStore();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<UnifiedCatalogDevice>(createDefaultCustomDevice());
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [aiReferenceUrl, setAiReferenceUrl] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  // Initialize or reset form data when opening modal
  useEffect(() => {
    if (isDeviceBuilderOpen) {
      if (editingCustomDevice) {
        setFormData(JSON.parse(JSON.stringify(editingCustomDevice)));
      } else {
        setFormData(createDefaultCustomDevice());
      }
      setCurrentStep(1);
      setAiError(null);
      setAiSuccessMsg(null);
    }
  }, [isDeviceBuilderOpen, editingCustomDevice]);

  if (!isDeviceBuilderOpen) return null;

  const isEditing = Boolean(editingCustomDevice);
  const rawAiAsistentEnv =
    (import.meta as any).env?.AI_ASISTENT ??
    (import.meta as any).env?.VITE_AI_ASISTENT ??
    (typeof process !== 'undefined' ? (process as any).env?.AI_ASISTENT : undefined) ??
    'FALSE';
  const isAiAssistantEnabled = String(rawAiAsistentEnv).trim().toUpperCase() === 'TRUE';

  // Helper updates
  const updateField = <K extends keyof UnifiedCatalogDevice>(key: K, value: UnifiedCatalogDevice[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const updateHardware = (updates: Partial<UnifiedCatalogDevice['hardware']>) => {
    setFormData((prev) => ({ ...prev, hardware: { ...prev.hardware, ...updates } }));
  };

  const updateCapabilities = (section: keyof UnifiedCatalogDevice['capabilities'], key: string, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [section]: {
          ...(prev.capabilities as any)[section],
          [key]: value,
        },
      },
    }));
  };

  const updatePerformance = (updates: Partial<UnifiedCatalogDevice['performance']>) => {
    setFormData((prev) => ({ ...prev, performance: { ...prev.performance, ...updates } }));
  };

  const updatePoe = (updates: Partial<NonNullable<UnifiedCatalogDevice['poe']>>) => {
    setFormData((prev) => ({
      ...prev,
      poe: {
        supported: prev.poe?.supported ?? false,
        ...prev.poe,
        ...updates,
      },
    }));
  };

  const updateWireless = (updates: Partial<NonNullable<UnifiedCatalogDevice['wireless']>>) => {
    setFormData((prev) => ({
      ...prev,
      wireless: {
        ...prev.wireless,
        ...updates,
      },
    }));
  };

  const updateCompatibility = (updates: Partial<UnifiedCatalogDevice['compatibility']>) => {
    setFormData((prev) => ({
      ...prev,
      compatibility: { ...prev.compatibility, ...updates },
    }));
  };

  const updateSimulationProfile = (updates: Partial<UnifiedCatalogDevice['simulationProfile']>) => {
    setFormData((prev) => ({
      ...prev,
      simulationProfile: { ...prev.simulationProfile, ...updates },
    }));
  };

  // Port Manager
  const addPort = () => {
    const nextIdx = formData.ports.length + 1;
    const newPortId = `port${nextIdx}`;
    const newPort: UnifiedPortSpec = {
      id: newPortId,
      name: `port${nextIdx}`,
      type: 'ethernet',
      category: 'fixed',
      defaultSpeed: '1G',
      supportedSpeeds: ['100M', '1G'],
      duplex: 'full',
      connectorType: 'RJ45',
      mediaType: 'copper-cat6',
      portPosition: nextIdx,
      portGroup: 'Ethernet',
    };
    const updatedPorts = [...formData.ports, newPort];
    setFormData((prev) => ({
      ...prev,
      ports: updatedPorts,
      portLayout: {
        ...prev.portLayout,
        totalPorts: updatedPorts.length,
        portsOrder: updatedPorts.map((p) => p.id),
      },
    }));
  };

  const removePort = (portId: string) => {
    const updatedPorts = formData.ports.filter((p) => p.id !== portId);
    setFormData((prev) => ({
      ...prev,
      ports: updatedPorts,
      portLayout: {
        ...prev.portLayout,
        totalPorts: updatedPorts.length,
        portsOrder: updatedPorts.map((p) => p.id),
      },
    }));
  };

  const updatePort = (portId: string, updates: Partial<UnifiedPortSpec>) => {
    setFormData((prev) => ({
      ...prev,
      ports: prev.ports.map((p) => (p.id === portId ? { ...p, ...updates } : p)),
    }));
  };

  // Source Reference Manager
  const addSourceRef = () => {
    const newRef: SourceReference = {
      id: `ref-${Date.now()}`,
      type: 'Manufacturer Datasheet',
      title: 'Official Product Datasheet',
      url: '',
      accessedAt: new Date().toISOString().slice(0, 10),
      verifiedBy: 'NETLAB Analyst',
    };
    setFormData((prev) => ({
      ...prev,
      sourceReferences: [...prev.sourceReferences, newRef],
    }));
  };

  const removeSourceRef = (refId: string) => {
    setFormData((prev) => ({
      ...prev,
      sourceReferences: prev.sourceReferences.filter((r) => r.id !== refId),
    }));
  };

  // AI Spec Extraction
  const handleAiExtract = async () => {
    if (!formData.brand && !formData.modelNumber && !aiInputText.trim()) {
      setAiError('Please enter at least Brand & Model Number, or paste Datasheet specifications text.');
      return;
    }

    setIsAiLoading(true);
    setAiError(null);
    setAiSuccessMsg(null);

    try {
      const res = await fetch('/api/ai/spec-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: formData.brand,
          modelNumber: formData.modelNumber,
          datasheetText: aiInputText,
          referenceUrl: aiReferenceUrl,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'AI server endpoint returned an error.');
      }

      const result = await res.json();
      if (result.suggestedSpec) {
        const s = result.suggestedSpec;
        setFormData((prev) => ({
          ...prev,
          name: s.name || prev.name,
          brand: s.brand || prev.brand,
          manufacturer: s.brand || prev.manufacturer,
          modelNumber: s.modelNumber || prev.modelNumber,
          productSeries: s.productSeries || prev.productSeries,
          category: s.category || prev.category,
          description: s.description || prev.description,
          formFactor: s.formFactor || prev.formFactor,
          verificationStatus: s.verificationStatus || 'PARTIALLY_VERIFIED',
          hardware: { ...prev.hardware, ...(s.hardware || {}) },
          ports: Array.isArray(s.ports) && s.ports.length > 0 ? s.ports : prev.ports,
          capabilities: { ...prev.capabilities, ...(s.capabilities || {}) },
          performance: { ...prev.performance, ...(s.performance || {}) },
          sourceReferences: Array.isArray(s.sourceReferences) && s.sourceReferences.length > 0
            ? s.sourceReferences.map((r: any, idx: number) => ({ id: `ref-ai-${idx}`, ...r }))
            : prev.sourceReferences,
        }));

        if (result.notice) {
          setAiSuccessMsg(result.notice);
        } else {
          setAiSuccessMsg(`Specifications successfully structured via ${result.source}! Review the extracted values in the wizard tabs before saving.`);
        }
      }
    } catch (err: any) {
      setAiError(err.message || 'Failed to extract specifications.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.brand.trim() || !formData.modelNumber.trim()) {
      alert('Please fill out Device Name, Brand, and Model Number.');
      setCurrentStep(1);
      return;
    }
    if (formData.ports.length === 0) {
      alert('A network device must have at least one physical interface.');
      setCurrentStep(3);
      return;
    }

    await saveCustomDevice(formData);
    closeDeviceBuilder();
  };

  const steps = [
    { num: 1, title: 'Basic Info', icon: <Server className="w-3.5 h-3.5" /> },
    { num: 2, title: 'Hardware', icon: <Cpu className="w-3.5 h-3.5" /> },
    { num: 3, title: 'Interfaces', icon: <Layers className="w-3.5 h-3.5" /> },
    { num: 4, title: 'Port Layout', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { num: 5, title: 'Capabilities', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { num: 6, title: 'Performance', icon: <Gauge className="w-3.5 h-3.5" /> },
    { num: 7, title: 'PoE', icon: <Zap className="w-3.5 h-3.5" /> },
    { num: 8, title: 'Wireless', icon: <Wifi className="w-3.5 h-3.5" /> },
    { num: 9, title: 'Compatibility', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-5xl w-full h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Wizard Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">
                  {isEditing ? `Edit Custom Device: ${formData.brand} ${formData.modelNumber}` : 'Custom Device Builder'}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  v{formData.specificationVersion}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    formData.verificationStatus === 'VERIFIED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : formData.verificationStatus === 'PARTIALLY_VERIFIED'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {formData.verificationStatus}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Build real-world network appliances with authentic physical ports, hardware specs, and simulation capabilities.
              </p>
            </div>
          </div>

          <button
            onClick={closeDeviceBuilder}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Navigation Strip */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto shrink-0 select-none">
          {steps.map((s) => {
            const isActive = currentStep === s.num;
            return (
              <button
                key={s.num}
                onClick={() => setCurrentStep(s.num)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.num}. {s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Main Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* AI Specification Assistant Card (Shown only when ENV AI_ASISTENT=TRUE) */}
          {isAiAssistantEnabled && (
            <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>AI Specification Assistant (Gemini)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Extract ports & hardware parameters automatically
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  placeholder="Optional Official Reference URL (e.g. mikrotik.com/product/... or cisco.com)"
                  value={aiReferenceUrl}
                  onChange={(e) => setAiReferenceUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste datasheet text or model details..."
                    value={aiInputText}
                    onChange={(e) => setAiInputText(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={handleAiExtract}
                    disabled={isAiLoading}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isAiLoading ? 'Extracting...' : 'Auto-Fill Specs'}</span>
                  </button>
                </div>
              </div>

              {aiSuccessMsg && (
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{aiSuccessMsg}</span>
                </div>
              )}
              {aiError && (
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              STEP 1: BASIC INFORMATION
             ========================================== */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Device Display Name <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g. Cisco Catalyst 9300-48P"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Brand / Vendor <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => {
                      updateField('brand', e.target.value);
                      if (!formData.manufacturer) updateField('manufacturer', e.target.value);
                    }}
                    placeholder="e.g. Cisco, MikroTik, Ubiquiti, Juniper"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Model Number <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.modelNumber}
                    onChange={(e) => updateField('modelNumber', e.target.value)}
                    placeholder="e.g. C9300-48P, CCR2116-12G-4S+"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => updateField('category', e.target.value as UnifiedDeviceCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="router">Router</option>
                    <option value="switch">Switch (L2)</option>
                    <option value="l3-switch">Layer 3 Switch</option>
                    <option value="firewall">Firewall / Security Appliance</option>
                    <option value="wireless-router">Wireless Router</option>
                    <option value="access-point">Access Point (AP)</option>
                    <option value="wireless-controller">Wireless Controller (WLC)</option>
                    <option value="modem">Modem / VDSL</option>
                    <option value="ont">ONT / GPON Terminal</option>
                    <option value="isp-gateway">ISP Gateway</option>
                    <option value="optical-terminal">Optical Terminal / OLT</option>
                    <option value="server">Compute Server</option>
                    <option value="storage-server">Storage Server / NAS</option>
                    <option value="hypervisor">Hypervisor Host</option>
                    <option value="virtual-machine">Virtual Machine</option>
                    <option value="container-host">Container Host</option>
                    <option value="load-balancer">Load Balancer</option>
                    <option value="network-appliance">Network Appliance</option>
                    <option value="custom-generic">Custom Generic Device</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Form Factor</label>
                  <select
                    value={formData.formFactor}
                    onChange={(e) => updateField('formFactor', e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1U Rackmount">1U Rackmount</option>
                    <option value="2U Rackmount">2U Rackmount</option>
                    <option value="Desktop">Desktop / SOHO</option>
                    <option value="Ceiling/Wall">Ceiling / Wall Mount</option>
                    <option value="Tower">Tower</option>
                    <option value="Virtual">Virtual / Appliance</option>
                    <option value="DIN-Rail">DIN-Rail Industrial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Product Series</label>
                  <input
                    type="text"
                    value={formData.productSeries || ''}
                    onChange={(e) => updateField('productSeries', e.target.value)}
                    placeholder="e.g. Catalyst 9000, RB Series"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Release Year</label>
                  <input
                    type="number"
                    min="1995"
                    max="2030"
                    value={formData.releaseYear || 2026}
                    onChange={(e) => updateField('releaseYear', parseInt(e.target.value, 10) || 2026)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Product Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Comprehensive physical description, intended deployment role, and primary hardware characteristics."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Source References & Verification Status */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white uppercase text-[11px] tracking-wider font-mono">
                      Datasheet & Documentation Sources
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({formData.sourceReferences.length} verified sources)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-slate-400 text-xs">
                      <span>Verification Status:</span>
                      <select
                        value={formData.verificationStatus}
                        onChange={(e) => updateField('verificationStatus', e.target.value as VerificationStatus)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-cyan-400 font-mono font-bold focus:outline-none"
                      >
                        <option value="UNVERIFIED">UNVERIFIED</option>
                        <option value="PARTIALLY_VERIFIED">PARTIALLY_VERIFIED</option>
                        <option value="VERIFIED">VERIFIED</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={addSourceRef}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-cyan-400" />
                      <span>Add Source Ref</span>
                    </button>
                  </div>
                </div>

                {formData.sourceReferences.map((ref, idx) => (
                  <div
                    key={ref.id}
                    className="grid grid-cols-1 md:grid-cols-4 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 items-center"
                  >
                    <select
                      value={ref.type}
                      onChange={(e) => {
                        const updated = [...formData.sourceReferences];
                        updated[idx].type = e.target.value as any;
                        setFormData((p) => ({ ...p, sourceReferences: updated }));
                      }}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-slate-300"
                    >
                      <option value="Manufacturer Datasheet">Manufacturer Datasheet</option>
                      <option value="Product Page">Official Product Page</option>
                      <option value="Technical Manual">Technical Manual</option>
                      <option value="Distributor Spec">Distributor Spec</option>
                      <option value="User Manual">User Manual</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Source Title / Document Code"
                      value={ref.title}
                      onChange={(e) => {
                        const updated = [...formData.sourceReferences];
                        updated[idx].title = e.target.value;
                        setFormData((p) => ({ ...p, sourceReferences: updated }));
                      }}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                    />

                    <input
                      type="text"
                      placeholder="Official URL (https://...)"
                      value={ref.url || ''}
                      onChange={(e) => {
                        const updated = [...formData.sourceReferences];
                        updated[idx].url = e.target.value;
                        setFormData((p) => ({ ...p, sourceReferences: updated }));
                      }}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono"
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {ref.accessedAt || '2026-10-30'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSourceRef(ref.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 2: HARDWARE SPECIFICATIONS
             ========================================== */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CPU Manufacturer</label>
                  <input
                    type="text"
                    value={formData.hardware.cpuManufacturer || ''}
                    onChange={(e) => updateHardware({ cpuManufacturer: e.target.value })}
                    placeholder="e.g. ARM, Intel, AMD, Marvell, Broadcom"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CPU Model</label>
                  <input
                    type="text"
                    value={formData.hardware.cpuModel || ''}
                    onChange={(e) => updateHardware({ cpuModel: e.target.value })}
                    placeholder="e.g. AL21400, Xeon D-1527, MT7621A"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CPU Architecture</label>
                  <input
                    type="text"
                    value={formData.hardware.cpuArchitecture || ''}
                    onChange={(e) => updateHardware({ cpuArchitecture: e.target.value })}
                    placeholder="e.g. ARM64, x86_64, MIPSBE, TILE"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CPU Cores</label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={formData.hardware.cpuCores || 4}
                    onChange={(e) => updateHardware({ cpuCores: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">CPU Frequency (MHz)</label>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    value={formData.hardware.cpuFrequencyMhz || 1400}
                    onChange={(e) => updateHardware({ cpuFrequencyMhz: parseInt(e.target.value, 10) || 1000 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">RAM Capacity (MB)</label>
                  <input
                    type="number"
                    min="64"
                    max="131072"
                    step="256"
                    value={formData.hardware.ramMb || 1024}
                    onChange={(e) => updateHardware({ ramMb: parseInt(e.target.value, 10) || 512 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Flash / Storage (MB)</label>
                  <input
                    type="number"
                    min="16"
                    max="1048576"
                    step="64"
                    value={formData.hardware.storageMb || 512}
                    onChange={(e) => updateHardware({ storageMb: parseInt(e.target.value, 10) || 64 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Operating System</label>
                  <input
                    type="text"
                    value={formData.hardware.operatingSystem || ''}
                    onChange={(e) => updateHardware({ operatingSystem: e.target.value })}
                    placeholder="e.g. MikroTik RouterOS v7, Cisco IOS-XE, VyOS"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Power Supply Type</label>
                  <select
                    value={formData.hardware.powerSupplyType || 'Internal AC'}
                    onChange={(e) => updateHardware({ powerSupplyType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Internal AC">Internal AC (100-240V)</option>
                    <option value="Dual Redundant AC">Dual Redundant Hot-Swap AC</option>
                    <option value="External DC Adapter">External DC Jack (12-57V)</option>
                    <option value="PoE-In Passive/802.3at">PoE-In Powered (802.3af/at)</option>
                    <option value="Other">Other / Dual DC Terminal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Cooling System</label>
                  <select
                    value={formData.hardware.coolingSystem || 'Passive (Fanless)'}
                    onChange={(e) => updateHardware({ coolingSystem: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Passive (Fanless)">Passive (Fanless Heatsink)</option>
                    <option value="Active (PWM Fans)">Active (PWM Internal Fans)</option>
                    <option value="Redundant Hot-Swap Fans">Redundant Hot-Swap Fans</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 3: PHYSICAL INTERFACES
             ========================================== */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="font-bold text-white text-xs">Physical Port Inventory</h3>
                  <span className="text-[11px] text-slate-400">
                    Define copper, fiber optic, and modular interface cages according to manufacturer datasheets.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addPort}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Physical Port</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {formData.ports.map((port, idx) => (
                  <div
                    key={port.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5 font-mono text-xs"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                      {/* Port ID & Name */}
                      <div>
                        <label className="text-[10px] text-slate-500 block">PORT ID</label>
                        <input
                          type="text"
                          value={port.id}
                          onChange={(e) => updatePort(port.id, { id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block">DISPLAY NAME</label>
                        <input
                          type="text"
                          value={port.name}
                          onChange={(e) => updatePort(port.id, { name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                        />
                      </div>

                      {/* Interface Type */}
                      <div>
                        <label className="text-[10px] text-slate-500 block">INTERFACE TYPE</label>
                        <select
                          value={port.type}
                          onChange={(e) => {
                            const newType = e.target.value as InterfaceType;
                            const isOpt = newType.startsWith('sfp') || newType.startsWith('qsfp');
                            updatePort(port.id, {
                              type: newType,
                              connectorType: isOpt ? 'LC' : (newType === 'wireless' ? 'Internal' : 'RJ45'),
                              mediaType: newType === 'sfp-plus' ? 'fiber-smf' : (newType === 'wireless' ? 'wireless-rf' : 'copper-cat6'),
                              defaultSpeed: newType === 'sfp-plus' ? '10G' : (newType === 'sfp28' ? '25G' : (newType === 'qsfp28' ? '100G' : '1G')),
                            });
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-300"
                        >
                          <option value="ethernet">Ethernet (RJ45)</option>
                          <option value="sfp">SFP (1G Cage)</option>
                          <option value="sfp-plus">SFP+ (10G Cage)</option>
                          <option value="sfp28">SFP28 (25G Cage)</option>
                          <option value="qsfp28">QSFP28 (100G Cage)</option>
                          <option value="wireless">Wireless RF</option>
                          <option value="management">Management Port</option>
                        </select>
                      </div>

                      {/* Default Speed */}
                      <div>
                        <label className="text-[10px] text-slate-500 block">SPEED</label>
                        <select
                          value={port.defaultSpeed}
                          onChange={(e) => updatePort(port.id, { defaultSpeed: e.target.value as InterfaceSpeed })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold"
                        >
                          <option value="10M">10 Mbps</option>
                          <option value="100M">100 Mbps</option>
                          <option value="1G">1 Gbps</option>
                          <option value="2.5G">2.5 Gbps</option>
                          <option value="5G">5 Gbps</option>
                          <option value="10G">10 Gbps</option>
                          <option value="25G">25 Gbps</option>
                          <option value="40G">40 Gbps</option>
                          <option value="100G">100 Gbps</option>
                        </select>
                      </div>

                      {/* Port Group */}
                      <div>
                        <label className="text-[10px] text-slate-500 block">PORT GROUP</label>
                        <input
                          type="text"
                          value={port.portGroup || ''}
                          onChange={(e) => updatePort(port.id, { portGroup: e.target.value })}
                          placeholder="e.g. LAN, WAN, Fiber Uplink"
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300 font-sans"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="flex justify-end pt-3">
                        <button
                          type="button"
                          onClick={() => removePort(port.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded transition-colors"
                          title="Delete this port"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Secondary Port Options */}
                    <div className="flex flex-wrap items-center gap-4 pt-1.5 border-t border-slate-800/80 text-[11px] text-slate-400 font-sans">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={port.poeCapability?.supportsIn || false}
                          onChange={(e) =>
                            updatePort(port.id, {
                              poeCapability: { ...port.poeCapability, supportsIn: e.target.checked },
                            })
                          }
                          className="accent-cyan-500"
                        />
                        <span>PoE-In Support</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={port.poeCapability?.supportsOut || false}
                          onChange={(e) =>
                            updatePort(port.id, {
                              poeCapability: { ...port.poeCapability, supportsOut: e.target.checked },
                            })
                          }
                          className="accent-amber-500"
                        />
                        <span>PoE-Out (PSE)</span>
                      </label>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] text-slate-500 uppercase font-mono">Position Index:</span>
                        <input
                          type="number"
                          min="1"
                          max="128"
                          value={port.portPosition}
                          onChange={(e) => updatePort(port.id, { portPosition: parseInt(e.target.value, 10) || 1 })}
                          className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 4: INTERFACE LAYOUT & FACEPLATE
             ========================================== */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-xs">Custom Faceplate Port Layout</h3>
                <span className="text-[11px] text-slate-400">
                  Preview how the physical ports will appear on the NETLAB topology canvas faceplate.
                </span>
              </div>

              {/* Visual Device Card Preview */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center">
                <div className="w-[360px] p-3 rounded-lg border border-cyan-500/40 bg-slate-900 shadow-2xl space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-white text-xs font-mono">{formData.name}</span>
                    <span className="text-[10px] text-cyan-400 uppercase font-mono font-bold">
                      {formData.category}
                    </span>
                  </div>

                  {/* Port Faceplate Grid */}
                  <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-950/80 rounded border border-slate-800">
                    {formData.ports.map((p) => {
                      const isOptical = p.type.startsWith('sfp') || p.type.startsWith('qsfp');
                      return (
                        <div
                          key={p.id}
                          className={`p-1.5 rounded flex flex-col items-center justify-center text-[9px] font-mono border ${
                            isOptical
                              ? 'bg-amber-950/20 border-amber-500/50 text-amber-300'
                              : 'bg-slate-800/80 border-slate-700 text-slate-200'
                          }`}
                          title={`${p.name} (${p.defaultSpeed} ${p.type})`}
                        >
                          <span className="truncate w-full text-center">{p.id}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-slate-500 flex justify-between font-mono">
                    <span>{formData.ports.length} Physical Ports</span>
                    <span>{formData.formFactor}</span>
                  </div>
                </div>
              </div>

              {/* Layout Form Factor Style */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Faceplate Style</label>
                  <select
                    value={formData.portLayout.faceplateStyle}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        portLayout: { ...p.portLayout, faceplateStyle: e.target.value as any },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="1U-Full-Width">1U Full-Width Rack Chassis</option>
                    <option value="2U-Full-Width">2U High-Density Rack Chassis</option>
                    <option value="Desktop-Front">Desktop Front-Facing</option>
                    <option value="Desktop-Rear">Desktop Rear-Facing</option>
                    <option value="Blade-Server">Modular Blade Enclosure</option>
                    <option value="Tower">Vertical Tower Chassis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Grid Columns on Canvas</label>
                  <input
                    type="number"
                    min="4"
                    max="24"
                    value={formData.portLayout.columns}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        portLayout: { ...p.portLayout, columns: parseInt(e.target.value, 10) || 8 },
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 5: NETWORK CAPABILITIES
             ========================================== */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-xs">Network Protocol & Layer Capabilities</h3>
                <span className="text-[11px] text-slate-400">
                  Select authentic features supported by the operating system and silicon chipsets.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* General & L2/L3 */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-cyan-400 block uppercase font-mono text-[10px]">
                    General Architecture
                  </span>
                  {[
                    ['layer2', 'Layer 2 Switching'],
                    ['layer3', 'Layer 3 Routing'],
                    ['ipv4', 'IPv4 Addressing'],
                    ['ipv6', 'IPv6 Dual-Stack'],
                    ['staticRouting', 'Static Routing Table'],
                    ['dynamicRouting', 'Dynamic Routing Daemon'],
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={(formData.capabilities.general as any)[k]}
                        onChange={(e) => updateCapabilities('general', k, e.target.checked)}
                        className="accent-cyan-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                {/* Switching */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-emerald-400 block uppercase font-mono text-[10px]">
                    Switching & L2
                  </span>
                  {[
                    ['vlanSupport', '802.1Q VLAN Tagging'],
                    ['vlanTrunking', 'VLAN Trunking Support'],
                    ['stp', 'Spanning Tree (STP)'],
                    ['rstp', 'Rapid STP (RSTP)'],
                    ['mstp', 'Multiple STP (MSTP)'],
                    ['linkAggregation', 'Bonding / Link Aggregation'],
                    ['lacp', '802.3ad LACP Support'],
                    ['jumboFrames', 'Jumbo Frames (9000B)'],
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={(formData.capabilities.switching as any)[k]}
                        onChange={(e) => updateCapabilities('switching', k, e.target.checked)}
                        className="accent-emerald-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                {/* Services & Routing */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-amber-400 block uppercase font-mono text-[10px]">
                    Network Services
                  </span>
                  {[
                    ['nat', 'NAT / Masquerade'],
                    ['dhcpServer', 'DHCP Server Daemon'],
                    ['dhcpClient', 'DHCP Client Prober'],
                    ['firewall', 'Stateful Packet Firewall'],
                    ['vpn', 'IPsec / WireGuard / OpenVPN'],
                    ['qos', 'QoS & Queuing Trees'],
                    ['trafficShaping', 'Bandwidth Limiter (Simple Queues)'],
                  ].map(([k, label]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={(formData.capabilities.networkServices as any)[k]}
                        onChange={(e) => updateCapabilities('networkServices', k, e.target.checked)}
                        className="accent-amber-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 6: CAPACITY & PERFORMANCE
             ========================================== */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-xs">Throughput & Forwarding Capacity</h3>
                <span className="text-[11px] text-slate-400">
                  Measured non-blocking switching fabric and CPU packet processing limits.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Switching Fabric Capacity (Gbps)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12800"
                    value={formData.performance.switchingCapacityGbps || 28}
                    onChange={(e) => updatePerformance({ switchingCapacityGbps: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Forwarding Rate (Mpps)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="2000"
                    value={formData.performance.forwardingRateMpps || 20.8}
                    onChange={(e) => updatePerformance({ forwardingRateMpps: parseFloat(e.target.value) || 1 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Max Routing Throughput (Mbps)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    max="100000"
                    value={formData.performance.routingThroughputMbps || 5000}
                    onChange={(e) => updatePerformance({ routingThroughputMbps: parseInt(e.target.value, 10) || 1000 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    MAC Address Table Size
                  </label>
                  <input
                    type="number"
                    step="1024"
                    value={formData.performance.maxMacTableSize || 16384}
                    onChange={(e) => updatePerformance({ maxMacTableSize: parseInt(e.target.value, 10) || 8192 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Max Concurrent Sessions
                  </label>
                  <input
                    type="number"
                    step="10000"
                    value={formData.performance.maxConcurrentSessions || 500000}
                    onChange={(e) => updatePerformance({ maxConcurrentSessions: parseInt(e.target.value, 10) || 100000 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Max Connected Endpoints
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={formData.performance.maxConnectedClients || 1000}
                    onChange={(e) => updatePerformance({ maxConnectedClients: parseInt(e.target.value, 10) || 500 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 7: POE CONFIGURATION
             ========================================== */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-xs">Power over Ethernet (PoE) Specifications</h3>
                <span className="text-[11px] text-slate-400">
                  Configure power sourcing equipment (PSE) and powered device (PD) standards.
                </span>
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-bold">
                  <input
                    type="checkbox"
                    checked={formData.poe?.supported || false}
                    onChange={(e) => updatePoe({ supported: e.target.checked })}
                    className="accent-cyan-500"
                  />
                  <span>This Device Supports PoE (Power over Ethernet)</span>
                </label>

                {formData.poe?.supported && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">PoE Role</label>
                      <select
                        value={formData.poe?.type || 'PSE (Power Sourcing)'}
                        onChange={(e) => updatePoe({ type: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                      >
                        <option value="PSE (Power Sourcing)">PSE (Power Sourcing to APs/CCTV)</option>
                        <option value="PD (Powered Device)">PD (Powered by Switch via PoE-In)</option>
                        <option value="Both (Passthrough)">Both (PoE Passthrough)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Standard</label>
                      <select
                        value={formData.poe?.standard || '802.3at (PoE+ 30W)'}
                        onChange={(e) => updatePoe({ standard: e.target.value as any })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                      >
                        <option value="802.3af (PoE 15.4W)">802.3af (PoE 15.4W)</option>
                        <option value="802.3at (PoE+ 30W)">802.3at (PoE+ 30W)</option>
                        <option value="802.3bt (PoE++ 60-90W)">802.3bt (PoE++ 60-90W)</option>
                        <option value="Passive 24V">Passive 24V</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Power Budget (Watts)</label>
                      <input
                        type="number"
                        min="15"
                        max="2000"
                        value={formData.poe?.powerBudgetWatts || 150}
                        onChange={(e) => updatePoe({ powerBudgetWatts: parseInt(e.target.value, 10) || 50 })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 8: WIRELESS SPECIFICATIONS
             ========================================== */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-xs">Wireless Radio & Wi-Fi Parameters</h3>
                <span className="text-[11px] text-slate-400">
                  Applicable for Wireless Routers, Access Points, and Wi-Fi Mesh gateways.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Wi-Fi Generation</label>
                  <select
                    value={formData.wireless?.wifiStandard || 'Wi-Fi 6 (802.11ax)'}
                    onChange={(e) => updateWireless({ wifiStandard: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                  >
                    <option value="Wi-Fi 7 (802.11be)">Wi-Fi 7 (802.11be)</option>
                    <option value="Wi-Fi 6 (802.11ax)">Wi-Fi 6 (802.11ax)</option>
                    <option value="Wi-Fi 5 (802.11ac)">Wi-Fi 5 (802.11ac)</option>
                    <option value="Wi-Fi 4 (802.11n)">Wi-Fi 4 (802.11n)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max PHY Rate (Mbps)</label>
                  <input
                    type="number"
                    step="100"
                    value={formData.wireless?.maxPhyRateMbps || 1800}
                    onChange={(e) => updateWireless({ maxPhyRateMbps: parseInt(e.target.value, 10) || 1200 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Spatial Streams (MIMO)</label>
                  <input
                    type="text"
                    value={formData.wireless?.spatialStreams || '2x2'}
                    onChange={(e) => updateWireless({ spatialStreams: e.target.value })}
                    placeholder="e.g. 2x2, 4x4, 8x8"
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              STEP 9: COMPATIBILITY & SIMULATION PROFILE
             ========================================== */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-white text-xs">Simulation Profile & Compatibility Matrix</h3>
                <span className="text-[11px] text-slate-400">
                  Specify which NETLAB simulation engines will emulate this device.
                </span>
              </div>

              {/* Simulation Profile Behaviors */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-cyan-400 block uppercase font-mono text-[10px]">
                    L2 Switching Behavior
                  </span>
                  <select
                    value={formData.simulationProfile.switchingBehavior}
                    onChange={(e) => updateSimulationProfile({ switchingBehavior: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                  >
                    <option value="SIMULATED">SIMULATED (Full Engine Emulation)</option>
                    <option value="SPECIFIED">SPECIFIED (Hardware Only)</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-emerald-400 block uppercase font-mono text-[10px]">
                    L3 Routing Behavior
                  </span>
                  <select
                    value={formData.simulationProfile.routingBehavior}
                    onChange={(e) => updateSimulationProfile({ routingBehavior: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                  >
                    <option value="SIMULATED">SIMULATED (Full Route Table)</option>
                    <option value="SPECIFIED">SPECIFIED (Hardware Only)</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="font-bold text-amber-400 block uppercase font-mono text-[10px]">
                    NAT & WAN Gateway
                  </span>
                  <select
                    value={formData.simulationProfile.natBehavior}
                    onChange={(e) => updateSimulationProfile({ natBehavior: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                  >
                    <option value="SIMULATED">SIMULATED (Source NAT Masquerade)</option>
                    <option value="SPECIFIED">SPECIFIED (Hardware Only)</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>
              </div>

              {/* Supported Media & Transceivers */}
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2.5">
                <span className="font-bold text-white text-xs block font-mono">
                  Supported Optical Transceivers
                </span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-300 font-mono">
                  {[
                    ['sfpplus-10g-lr', '10G LR (Single-Mode 10km)'],
                    ['sfpplus-10g-sr', '10G SR (Multi-Mode 300m)'],
                    ['sfpplus-10g-er', '10G ER (Single-Mode 40km)'],
                    ['sfpplus-10g-bidi-u', '10G BiDi Up (Tx1270/Rx1330)'],
                    ['sfpplus-10g-bidi-d', '10G BiDi Down (Tx1330/Rx1270)'],
                    ['sfpplus-10g-rj45', '10G Copper Module (S+RJ10)'],
                    ['sfp-1g-lx', '1G SFP LX (1310nm 10km)'],
                    ['sfp-1g-sx', '1G SFP SX (850nm 550m)'],
                  ].map(([val, label]) => {
                    const isChecked = formData.compatibility.supportedTransceivers.includes(val as any);
                    return (
                      <label key={val} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = formData.compatibility.supportedTransceivers;
                            const next = e.target.checked
                              ? [...current, val as any]
                              : current.filter((x) => x !== val);
                            updateCompatibility({ supportedTransceivers: next });
                          }}
                          className="accent-cyan-500"
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous Step</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Step {currentStep} of {steps.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentStep < steps.length ? (
              <button
                type="button"
                onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>Next Step</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Save Specification Updates' : 'Register to Custom Catalog'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
