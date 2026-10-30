import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { DEVICE_CATALOG } from '../data/deviceCatalog';
import { CABLE_SPECIFICATIONS, TRANSCEIVER_SPECIFICATIONS } from '../data/mediaSpecs';
import { DeviceCategory, DeviceModel } from '../types/network';
import {
  Server,
  Router,
  Wifi,
  Globe,
  Monitor,
  HardDrive,
  Layers,
  Search,
  Plus,
  Cable,
  BookOpen,
  Sparkles,
  Trash2,
  PanelLeftClose,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onToggle }) => {
  const {
    addDevice,
    activeProject,
    createNewProject,
    customDevices,
    openDeviceBuilder,
    deleteCustomDevice,
    duplicateCustomDevice,
    exportCustomDeviceJson,
    exportAllCustomDevicesJson,
    importCustomDeviceJson,
    openUserGuide,
  } = useNetworkStore();

  const [activeTab, setActiveTab] = useState<'catalog' | 'templates' | 'media'>('catalog');
  const [catalogMode, setCatalogMode] = useState<'builtin' | 'custom'>('builtin');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSpeedFilter, setSelectedSpeedFilter] = useState<string>('all');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // File import ref
  const importFileRef = React.useRef<HTMLInputElement>(null);

  const filteredBuiltIn = DEVICE_CATALOG.filter((dev) => {
    const matchesCategory = selectedCategory === 'all' || dev.category === selectedCategory;
    const matchesSearch =
      dev.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeed = selectedSpeedFilter === 'all' || dev.ports.some((p) => p.defaultSpeed === selectedSpeedFilter);
    return matchesCategory && matchesSearch && matchesSpeed;
  });

  const filteredCustom = (customDevices || []).filter((dev) => {
    if (!dev) return false;
    const matchesCategory = selectedCategory === 'all' || dev.category === selectedCategory;
    const searchLow = (searchQuery || '').toLowerCase();
    const name = (dev.name || '').toLowerCase();
    const brand = (dev.brand || '').toLowerCase();
    const modelNum = (dev.modelNumber || '').toLowerCase();
    const desc = (dev.description || (dev as any).productDescription || '').toLowerCase();
    const matchesSearch =
      name.includes(searchLow) ||
      brand.includes(searchLow) ||
      modelNum.includes(searchLow) ||
      desc.includes(searchLow);
    const ports = Array.isArray(dev.ports) ? dev.ports : Array.isArray((dev as any).interfaces) ? (dev as any).interfaces : [];
    const matchesSpeed = selectedSpeedFilter === 'all' || ports.some((p: any) => (p.defaultSpeed || p.speed) === selectedSpeedFilter);
    return matchesCategory && matchesSearch && matchesSpeed;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'router':
      case 'wireless-router':
        return <Router className="w-4 h-4 text-cyan-400" />;
      case 'switch':
      case 'l3-switch':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'wireless':
      case 'access-point':
      case 'wireless-controller':
        return <Wifi className="w-4 h-4 text-amber-400" />;
      case 'wan':
      case 'isp-gateway':
      case 'modem':
      case 'ont':
      case 'optical-terminal':
        return <Globe className="w-4 h-4 text-sky-400" />;
      case 'server':
      case 'storage-server':
      case 'hypervisor':
      case 'container-host':
        return <Server className="w-4 h-4 text-purple-400" />;
      case 'endpoint':
      case 'network-appliance':
      case 'virtual-machine':
      case 'load-balancer':
        return <Monitor className="w-4 h-4 text-indigo-400" />;
      default:
        return <HardDrive className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleAddBuiltIn = (model: DeviceModel) => {
    const vp = activeProject.viewport || { x: 0, y: 0, zoom: 1 };
    const x = Math.round(-vp.x + 350 + (Math.random() * 80 - 40));
    const y = Math.round(-vp.y + 200 + (Math.random() * 80 - 40));
    addDevice(model.id, undefined, x, y);
  };

  const handleAddCustom = (dev: import('../types/network').UnifiedCatalogDevice) => {
    const vp = activeProject.viewport || { x: 0, y: 0, zoom: 1 };
    const x = Math.round(-vp.x + 350 + (Math.random() * 80 - 40));
    const y = Math.round(-vp.y + 200 + (Math.random() * 80 - 40));
    addDevice(dev.id, undefined, x, y);
  };

  const handleExportSingle = (dev: import('../types/network').UnifiedCatalogDevice, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = exportCustomDeviceJson(dev);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `custom_device_${dev.brand.toLowerCase()}_${dev.modelNumber.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const jsonStr = exportAllCustomDevicesJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `netlab_custom_devices_catalog.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = await importCustomDeviceJson(content);
        if (result.success) {
          setImportStatus(`Successfully imported ${result.count} custom device(s)!`);
          setCatalogMode('custom');
          setTimeout(() => setImportStatus(null), 3000);
        } else {
          setImportStatus(`Failed to import device JSON: ${result.error || 'Invalid structure'}`);
          setTimeout(() => setImportStatus(null), 4000);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <aside className="w-84 border-r border-slate-800 bg-slate-900/95 flex flex-col h-full select-none shrink-0 z-30 transition-all">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-2.5 py-2 bg-slate-950/40 gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'catalog'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Catalog</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'templates'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Blueprints</span>
          </button>

          <button
            onClick={() => setActiveTab('media')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
              activeTab === 'media'
                ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cable className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Specs</span>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => openUserGuide('device-management')}
            title="Panduan Device Catalog & Custom Device"
            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          {onToggle && (
            <button
              onClick={onToggle}
              title="Sembunyikan Sidebar Kiri (Perluas Canvas)"
              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded border border-transparent hover:border-slate-700 transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Catalog */}
      {activeTab === 'catalog' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-Tabs: Built-in vs Custom Devices */}
          <div className="p-2.5 pb-0 bg-slate-950/60 border-b border-slate-800/80">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
              <button
                onClick={() => setCatalogMode('builtin')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  catalogMode === 'builtin'
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Built-in Devices</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 font-mono">
                  {DEVICE_CATALOG.length}
                </span>
              </button>

              <button
                onClick={() => setCatalogMode('custom')}
                className={`py-1.5 px-2 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  catalogMode === 'custom'
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>My Custom Devices</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${customDevices.length > 0 ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'bg-slate-950 text-slate-500'}`}>
                  {customDevices.length}
                </span>
              </button>
            </div>

            {/* Custom Device Action Strip */}
            {catalogMode === 'custom' && (
              <div className="flex items-center justify-between gap-1.5 py-2">
                <button
                  onClick={() => openDeviceBuilder()}
                  className="flex-1 py-1.5 px-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Device</span>
                </button>

                <button
                  onClick={() => importFileRef.current?.click()}
                  title="Import device JSON file"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded border border-slate-700 text-xs transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={handleExportAll}
                  disabled={customDevices.length === 0}
                  title="Export all custom devices as JSON"
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white rounded border border-slate-700 text-xs transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>

                <input
                  ref={importFileRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>
            )}

            {importStatus && (
              <div className="mb-2 p-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] text-center font-mono">
                {importStatus}
              </div>
            )}
          </div>

          {/* Search Bar & Multi-Criteria Filters */}
          <div className="p-3 border-b border-slate-800/80 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder={catalogMode === 'builtin' ? "Search MikroTik CCR, RB, SFP+..." : "Search custom brand, model, ports..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            {/* Category Filter Dropdown & Port Speed Selector */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none capitalize"
              >
                <option value="all">All Categories</option>
                <option value="router">Routers</option>
                <option value="switch">Switches (L2/L3)</option>
                <option value="access-point">Access Points (AP)</option>
                <option value="firewall">Firewalls</option>
                <option value="isp-gateway">ISP & WAN</option>
                <option value="server">Servers</option>
                <option value="network-appliance">Appliances</option>
              </select>

              <select
                value={selectedSpeedFilter}
                onChange={(e) => setSelectedSpeedFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 focus:outline-none"
              >
                <option value="all">All Port Speeds</option>
                <option value="1G">1G Ports</option>
                <option value="2.5G">2.5G Ports</option>
                <option value="10G">10G SFP+ Ports</option>
                <option value="25G">25G SFP28</option>
                <option value="100G">100G QSFP28</option>
              </select>
            </div>
          </div>

          {/* Model List View */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {catalogMode === 'builtin' ? (
              /* Built-in Catalog List */
              filteredBuiltIn.map((model) => {
                const sfpPorts = model.ports.filter((p) => p.type === 'sfp' || p.type === 'sfp-plus' || p.type === 'sfp28');
                const gbePorts = model.ports.filter((p) => p.type === 'ethernet');

                return (
                  <div
                    key={model.id}
                    className="bg-slate-800/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-all flex flex-col gap-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded bg-slate-900 border border-slate-700/60 shrink-0">
                          {getCategoryIcon(model.category)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white tracking-tight truncate">{model.model}</h4>
                          <span className="text-[10px] text-slate-400 block truncate">{model.vendor} · {model.formFactor}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAddBuiltIn(model)}
                        title="Add to Canvas"
                        className="p-1 rounded bg-slate-700 hover:bg-cyan-600 text-slate-200 hover:text-white transition-colors shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {model.description}
                    </p>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700/40 text-[10px] font-mono text-slate-300">
                      {gbePorts.length > 0 && <span>{gbePorts.length}x GbE</span>}
                      {sfpPorts.length > 0 && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-amber-400 font-semibold">
                            {sfpPorts.length}x {sfpPorts[0].defaultSpeed} SFP+
                          </span>
                        </>
                      )}
                      {model.routerOsVersion && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="text-cyan-400">RouterOS {model.routerOsVersion}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* Custom Devices List */
              <>
                {filteredCustom.map((dev) => {
                  const ports = Array.isArray(dev.ports) ? dev.ports : Array.isArray((dev as any).interfaces) ? (dev as any).interfaces : [];
                  const sfpPorts = ports.filter((p: any) => {
                    const t = (p.type || '').toLowerCase();
                    return t.startsWith('sfp') || t.startsWith('qsfp') || t === 'fiber-sm' || t === 'fiber-mm';
                  });
                  const ethPorts = ports.filter((p: any) => {
                    const t = (p.type || '').toLowerCase();
                    return t === 'ethernet' || t.includes('ethernet');
                  });
                  const descriptionText = dev.description || (dev as any).productDescription || '';

                  return (
                    <div
                      key={dev.id}
                      className="bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 rounded-xl p-3 transition-all flex flex-col gap-2 relative group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded bg-slate-900 border border-slate-700 shrink-0">
                            {getCategoryIcon(dev.category)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white tracking-tight truncate">
                                {dev.brand} {dev.modelNumber}
                              </h4>
                              <span className="text-[9px] px-1 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                                v{dev.specificationVersion}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {dev.name} · {dev.formFactor}
                            </span>
                          </div>
                        </div>

                        {/* Card Top Action: Add to canvas */}
                        <button
                          onClick={() => handleAddCustom(dev)}
                          title="Instantiate onto Canvas"
                          className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition-colors shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {descriptionText}
                      </p>

                      {/* Ports & Status Bar */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/60 text-[10px] font-mono">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span>{ports.length} ports</span>
                          {sfpPorts.length > 0 && (
                            <>
                              <span className="text-slate-600">·</span>
                              <span className="text-amber-400 font-bold">{sfpPorts.length}x SFP+</span>
                            </>
                          )}
                        </div>

                        <span
                          className={`px-1.5 py-0.2 rounded uppercase font-bold text-[9px] ${
                            dev.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : dev.verificationStatus === 'PARTIALLY_VERIFIED'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          {dev.verificationStatus}
                        </span>
                      </div>

                      {/* Action Bar for Custom Device */}
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-slate-800">
                        <button
                          onClick={() => openDeviceBuilder(dev)}
                          title="Edit Specification"
                          className="px-2 py-1 text-[10px] rounded bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => duplicateCustomDevice(dev.id)}
                          title="Duplicate as new template"
                          className="px-2 py-1 text-[10px] rounded bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          Duplicate
                        </button>

                        <button
                          onClick={(e) => handleExportSingle(dev, e)}
                          title="Export device JSON"
                          className="px-2 py-1 text-[10px] rounded bg-slate-900 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                          Export
                        </button>

                        <button
                          onClick={() => deleteCustomDevice(dev.id)}
                          title="Delete from Catalog"
                          className="p-1 rounded bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {customDevices.length === 0 && (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-800 rounded-xl space-y-3">
                    <Server className="w-8 h-8 text-slate-600 mx-auto" />
                    <div className="space-y-1">
                      <span className="font-bold text-white text-xs block">No Custom Devices Yet</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Design routers, switches, firewalls, and servers based on real datasheets or import existing models.
                      </p>
                    </div>
                    <button
                      onClick={() => openDeviceBuilder()}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Your First Device</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Topology Templates */}
      {activeTab === 'templates' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-xs text-slate-400 mb-2">
            Load certified network architecture blueprints for campus and enterprise deployments.
          </div>

          {/* Template 1 */}
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-3 hover:border-cyan-500/50 transition-colors">
            <h4 className="text-xs font-bold text-white mb-1">Campus Core & SFP+ Fiber Ring</h4>
            <p className="text-[11px] text-slate-400 mb-3">
              MikroTik CCR2116 Flagship Router, CRS326 Distribution switch connected via 10G Single-Mode Fiber LC, VLAN 20 (Civitas) and VLAN 30 (Student).
            </p>
            <button
              onClick={() => {
                createNewProject('Kampus Terpadu — Core & SFP+ Fiber Ring', 'Campus backbone architecture with CCR2116 and CRS326 distribution.');
              }}
              className="w-full py-1.5 text-xs bg-cyan-600/30 hover:bg-cyan-600 border border-cyan-500/40 text-cyan-200 hover:text-white rounded font-medium transition-colors"
            >
              Load Campus Blueprint
            </button>
          </div>

          {/* Template 2 */}
          <div className="bg-slate-800/60 border border-slate-700/70 rounded-lg p-3 hover:border-cyan-500/50 transition-colors">
            <h4 className="text-xs font-bold text-white mb-1">Dual-WAN Failover & PCC Multi-Homing</h4>
            <p className="text-[11px] text-slate-400 mb-3">
              MikroTik RB5009 with Primary Telkom DIA 300Mbps + Starlink LEO Satellite backup, policy-based routing, and NAT.
            </p>
            <button
              onClick={() => {
                createNewProject('Dual-WAN ISP Failover Lab', 'Dual-WAN topology with Starlink backup and CCR/RB load balancer.');
              }}
              className="w-full py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded font-medium transition-colors"
            >
              Load Dual-WAN Blueprint
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Fiber & Cables Knowledge Guide */}
      {activeTab === 'media' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="text-xs text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Optical & Physical Media Standards</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            In NETLAB, cable media and transceiver types must physically match to establish valid Layer 1 links.
          </p>

          {/* Cable Types */}
          <div className="space-y-2">
            {Object.values(CABLE_SPECIFICATIONS).map((spec) => (
              <div key={spec.id} className="bg-slate-800/50 border border-slate-700/60 rounded p-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: spec.colorHex }}
                  />
                  <span className="text-xs font-bold text-white">{spec.name}</span>
                </div>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  Connector: <span className="text-slate-300 font-mono">{spec.connectorType}</span> · Max Distance: <span className="text-slate-300 font-mono">{spec.maxDistanceMeters}m</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{spec.description}</p>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-300 font-semibold pt-2 border-t border-slate-800">
            Available MikroTik SFP/SFP+ Transceivers
          </div>

          <div className="space-y-1.5">
            {Object.entries(TRANSCEIVER_SPECIFICATIONS).filter(([k, v]) => v !== null).map(([k, trans]) => (
              trans && (
                <div key={k} className="p-2 rounded bg-slate-950/60 border border-slate-800/80 text-[11px]">
                  <div className="font-semibold text-slate-200">{trans.modelName}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Speed: {trans.speed} · Form: {trans.formFactor} · Fiber: {trans.fiberType.toUpperCase()} {trans.wavelengthNm ? `· ${trans.wavelengthNm}nm` : ''}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
