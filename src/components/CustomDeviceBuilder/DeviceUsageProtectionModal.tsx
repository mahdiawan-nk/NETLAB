import React from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import { AlertTriangle, X, ShieldAlert, Trash2 } from 'lucide-react';

export const DeviceUsageProtectionModal: React.FC = () => {
  const { usageProtectionModal, closeUsageProtectionModal, deleteCustomDevice } = useNetworkStore();

  if (!usageProtectionModal?.isOpen) return null;

  const { deviceId, deviceName, usage } = usageProtectionModal;

  const handleForceDelete = async () => {
    await deleteCustomDevice(deviceId, true);
    closeUsageProtectionModal();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/50 rounded-xl max-w-md w-full shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 bg-amber-950/30 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-amber-400">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-bold text-white">Device Deletion Protection</h3>
          </div>
          <button
            onClick={closeUsageProtectionModal}
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-300">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 block">
                Cannot Safely Delete "{deviceName}"
              </span>
              <p className="text-[11.5px] text-amber-200/80 leading-relaxed">
                This catalog device is currently deployed in <strong className="text-white">{usage.projects.length} project(s)</strong> with a total of <strong className="text-white">{usage.totalDeviceCount} active instance(s)</strong>.
              </p>
            </div>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 uppercase font-mono font-semibold tracking-wider block mb-2">
              Referenced In Projects:
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded border border-slate-800">
              {usage.projects.map((proj) => (
                <div
                  key={proj.id}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-900/60 font-mono"
                >
                  <span className="text-slate-200 truncate font-medium">{proj.name}</span>
                  <span className="text-amber-400 font-bold text-[11px] shrink-0">
                    {proj.deviceCount} {proj.deviceCount === 1 ? 'instance' : 'instances'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Deleting this device from the catalog will remove it from future project creation. Existing instances on the topology canvas will retain their current snapshot specification and continue functioning.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-2.5">
          <button
            onClick={closeUsageProtectionModal}
            className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel & Keep Device
          </button>
          <button
            onClick={handleForceDelete}
            className="px-3.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Force Delete from Catalog</span>
          </button>
        </div>
      </div>
    </div>
  );
};
