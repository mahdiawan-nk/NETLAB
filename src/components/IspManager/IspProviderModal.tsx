import React, { useState } from 'react';
import { IspProvider, IspProviderType } from '../../types/network';
import { Globe, X, Building2, Phone, ExternalLink, FileText, CheckCircle2 } from 'lucide-react';

interface IspProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: Omit<IspProvider, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: IspProvider | null;
}

const PROVIDER_TYPES: { type: IspProviderType; label: string; desc: string }[] = [
  { type: 'dedicated', label: 'Dedicated Internet Access (DIA)', desc: 'Symmetrical 1:1 CIR guaranteed enterprise transit' },
  { type: 'fiber', label: 'Fiber Optic Enterprise', desc: 'Direct low-latency fiber optic leased line' },
  { type: 'broadband', label: 'Broadband / FTTH', desc: 'Asymmetric shared consumer or business broadband' },
  { type: 'metro-ethernet', label: 'Metro Ethernet / L2 VPN', desc: 'Point-to-point / multipoint carrier Ethernet' },
  { type: 'wireless', label: 'Wireless ISP (WISP / Microwave)', desc: 'Point-to-Point licensed / unlicensed radio link' },
  { type: 'satellite', label: 'Satellite (LEO / VSAT)', desc: 'Starlink LEO or geostationary satellite backup' },
  { type: 'private-wan', label: 'Private WAN / MPLS', desc: 'Private carrier MPLS VPN connecting branch offices' },
  { type: 'other', label: 'Other Transit Provider', desc: 'Generic custom internet or upstream link' },
];

export const IspProviderModal: React.FC<IspProviderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<IspProviderType>(initialData?.type || 'dedicated');
  const [website, setWebsite] = useState(initialData?.website || '');
  const [customerService, setCustomerService] = useState(initialData?.customerService || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(initialData?.status || 'active');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Provider name is required.');
      return;
    }

    onSave({
      name: name.trim(),
      type,
      website: website.trim() || undefined,
      customerService: customerService.trim() || undefined,
      description: description.trim() || undefined,
      status,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {initialData ? 'Edit ISP Provider' : 'Register New ISP Provider'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Configure upstream internet service provider details and corporate contacts.
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Provider Name */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Provider Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Telkom Astinet, Biznet Enterprise, Indosat Ooredoo"
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              required
            />
          </div>

          {/* Provider Type */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Provider Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IspProviderType)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              {PROVIDER_TYPES.map((pt) => (
                <option key={pt.type} value={pt.type}>
                  {pt.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              {PROVIDER_TYPES.find((pt) => pt.type === type)?.desc}
            </p>
          </div>

          {/* Contacts: Website & Customer Service */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>Website</span>
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-400" />
                <span>Customer Service / NOC</span>
              </label>
              <input
                type="text"
                value={customerService}
                onChange={(e) => setCustomerService(e.target.value)}
                placeholder="147 / 0800-XXX / noc@isp.net"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>Description & SLA Notes</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Tier-1 Indonesian transit with upstream peering in Cyber 1, 99.5% availability guarantee..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Provider Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800">
            <div>
              <span className="font-medium text-white block">Provider Status</span>
              <span className="text-[10px] text-slate-400">
                Inactive providers are preserved in directory but cannot provision new circuits.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatus(status === 'active' ? 'inactive' : 'active')}
              className={`px-3 py-1 rounded-md text-xs font-bold font-mono transition-colors ${
                status === 'active'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {status.toUpperCase()}
            </button>
          </div>

          {/* Footer Buttons */}
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
              <span>{initialData ? 'Save Changes' : 'Register Provider'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
