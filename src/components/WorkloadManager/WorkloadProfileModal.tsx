import React, { useState, useEffect } from 'react';
import {
  WorkloadProfile,
  WorkloadProfileCategory,
  ApplicationTrafficModel,
  TrafficPriority,
} from '../../types/ispWorkload';
import { X, Plus, Trash2, Sliders, Layers, Sparkles, Check, AlertCircle } from 'lucide-react';

interface WorkloadProfileModalProps {
  isOpen: boolean;
  profile?: WorkloadProfile | null;
  onClose: () => void;
  onSave: (data: Omit<WorkloadProfile, 'id'>) => void;
}

const CATEGORY_OPTIONS: { id: WorkloadProfileCategory; label: string; desc: string }[] = [
  { id: 'office', label: 'Office Enterprise', desc: 'SaaS, video calls, corporate chat & cloud storage' },
  { id: 'campus', label: 'Academic Campus', desc: 'High-density Wi-Fi, LMS, research downloads & streaming' },
  { id: 'residential', label: 'Residential / FTTH', desc: '4K/8K streaming, online gaming, social media & smart home' },
  { id: 'small-business', label: 'Small Business / Retail', desc: 'POS transactions, guest Wi-Fi, cloud accounting' },
  { id: 'server', label: 'Server & Cloud Cluster', desc: 'Database sync, API traffic, backup replication' },
  { id: 'cctv', label: 'CCTV & Surveillance', desc: 'Continuous RTSP/ONVIF camera uplink streams' },
  { id: 'custom', label: 'Custom Specification', desc: 'Tailored application mix and bitrate constraints' },
];

export const WorkloadProfileModal: React.FC<WorkloadProfileModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WorkloadProfileCategory>('office');
  const [description, setDescription] = useState('');
  const [defaultDeviceCount, setDefaultDeviceCount] = useState<number>(10);
  const [defaultActiveUsers, setDefaultActiveUsers] = useState<number>(25);
  const [defaultConcurrencyFactor, setDefaultConcurrencyFactor] = useState<number>(0.4);
  const [applications, setApplications] = useState<ApplicationTrafficModel[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setCategory(profile.category);
      setDescription(profile.description || '');
      setDefaultDeviceCount(profile.defaultDeviceCount || 10);
      setDefaultActiveUsers(profile.defaultActiveUsers || 25);
      setDefaultConcurrencyFactor(profile.defaultConcurrencyFactor ?? 0.4);
      setApplications(profile.applications ? JSON.parse(JSON.stringify(profile.applications)) : []);
    } else {
      setName('New Workload Profile');
      setCategory('office');
      setDescription('Custom application mix and network concurrency profile.');
      setDefaultDeviceCount(15);
      setDefaultActiveUsers(30);
      setDefaultConcurrencyFactor(0.35);
      setApplications([
        {
          id: `app-${Date.now()}-1`,
          name: 'Web Browsing & HTTPS',
          category: 'Web',
          downloadRateKbps: 2000,
          uploadRateKbps: 300,
          averageBitrateKbps: 600,
          peakBitrateKbps: 3500,
          activityProbability: 0.5,
          concurrentSessions: 6,
          trafficPriority: 'normal',
          latencySensitivity: 'medium',
        },
        {
          id: `app-${Date.now()}-2`,
          name: 'Video Collaboration',
          category: 'Real-Time',
          downloadRateKbps: 3000,
          uploadRateKbps: 2500,
          averageBitrateKbps: 2200,
          peakBitrateKbps: 4000,
          activityProbability: 0.3,
          concurrentSessions: 1,
          trafficPriority: 'high',
          latencySensitivity: 'ultra-low',
        },
      ]);
    }
    setValidationError(null);
  }, [profile, isOpen]);

  if (!isOpen) return null;

  const handleAddApp = () => {
    const newApp: ApplicationTrafficModel = {
      id: `app-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: 'Custom Application',
      category: 'General',
      downloadRateKbps: 1500,
      uploadRateKbps: 500,
      averageBitrateKbps: 800,
      peakBitrateKbps: 2500,
      activityProbability: 0.4,
      concurrentSessions: 4,
      trafficPriority: 'normal',
      latencySensitivity: 'medium',
    };
    setApplications([...applications, newApp]);
  };

  const handleUpdateApp = (index: number, updates: Partial<ApplicationTrafficModel>) => {
    setApplications((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleRemoveApp = (index: number) => {
    setApplications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setValidationError('Profile name is required.');
      return;
    }
    if (applications.length === 0) {
      setValidationError('At least one application must be included in the profile.');
      return;
    }

    onSave({
      name: name.trim(),
      category,
      description: description.trim(),
      defaultDeviceCount: Math.max(1, defaultDeviceCount),
      defaultActiveUsers: Math.max(1, defaultActiveUsers),
      defaultConcurrencyFactor: Math.min(1.0, Math.max(0.01, defaultConcurrencyFactor)),
      applications,
      isCustom: true,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {profile ? 'Edit Workload Profile' : 'Create Reusable Workload Profile'}
              </h2>
              <p className="text-xs text-slate-400">
                Define typical application traffic, concurrency ratio, and user behavior parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> 1. Profile Definition & Category
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Profile Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Modern High-Density Co-Working"
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as WorkloadProfileCategory)}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({cat.desc})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Operational details, expected traffic pattern, and environment..."
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Concurrency & Defaults */}
          <div className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> 2. Concurrency & Sizing Baselines
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Device Sizing
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={defaultDeviceCount}
                  onChange={(e) => setDefaultDeviceCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-slate-500">Endpoints / Nodes in group</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Active Users
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={defaultActiveUsers}
                  onChange={(e) => setDefaultActiveUsers(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-slate-500">Total concurrent human users</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Concurrency Factor</label>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    {Math.round(defaultConcurrencyFactor * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(defaultConcurrencyFactor * 100)}
                  onChange={(e) => setDefaultConcurrencyFactor(parseInt(e.target.value) / 100)}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="text-[11px] text-slate-500">Simultaneous traffic duty factor</span>
              </div>
            </div>
          </div>

          {/* Section 3: Applications Mix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  3. Applications & Bitrate Profile ({applications.length})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Down/Up bitrates, duty cycle probability (0-100%), and latency requirements
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddApp}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Application
              </button>
            </div>

            <div className="space-y-3">
              {applications.map((app, idx) => (
                <div
                  key={app.id || idx}
                  className="p-3.5 bg-slate-800/60 border border-slate-700/70 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={app.name}
                        onChange={(e) => handleUpdateApp(idx, { name: e.target.value })}
                        placeholder="App Name (e.g. 4K Streaming)"
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={app.category || ''}
                        onChange={(e) => handleUpdateApp(idx, { category: e.target.value })}
                        placeholder="Category (e.g. Multimedia)"
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveApp(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove Application"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">Down (Kbps)</span>
                      <input
                        type="number"
                        min={10}
                        value={app.downloadRateKbps}
                        onChange={(e) =>
                          handleUpdateApp(idx, { downloadRateKbps: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">Up (Kbps)</span>
                      <input
                        type="number"
                        min={10}
                        value={app.uploadRateKbps}
                        onChange={(e) =>
                          handleUpdateApp(idx, { uploadRateKbps: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">Peak (Kbps)</span>
                      <input
                        type="number"
                        min={10}
                        value={app.peakBitrateKbps}
                        onChange={(e) =>
                          handleUpdateApp(idx, { peakBitrateKbps: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">
                        Duty Cycle ({Math.round((app.activityProbability || 0.5) * 100)}%)
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        step={5}
                        value={Math.round((app.activityProbability || 0.5) * 100)}
                        onChange={(e) =>
                          handleUpdateApp(idx, { activityProbability: parseInt(e.target.value) / 100 })
                        }
                        className="w-full accent-cyan-400 cursor-pointer mt-1"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">Priority</span>
                      <select
                        value={app.trafficPriority}
                        onChange={(e) =>
                          handleUpdateApp(idx, { trafficPriority: e.target.value as TrafficPriority })
                        }
                        className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                        <option value="best-effort">Best Effort</option>
                      </select>
                    </div>

                    <div>
                      <span className="block text-[10px] text-slate-400 mb-0.5">Latency</span>
                      <select
                        value={app.latencySensitivity}
                        onChange={(e) =>
                          handleUpdateApp(idx, {
                            latencySensitivity: e.target.value as any,
                          })
                        }
                        className="w-full px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                      >
                        <option value="ultra-low">Ultra-Low</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="tolerant">Tolerant</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all"
            >
              <Check className="w-4 h-4" /> Save Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
