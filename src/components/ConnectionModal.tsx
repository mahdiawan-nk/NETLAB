import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import { MediaType, OpticalTransceiverType } from '../types/network';
import { CABLE_SPECIFICATIONS, TRANSCEIVER_SPECIFICATIONS } from '../data/mediaSpecs';
import { Cable, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

interface ConnectionModalDialogProps {
  pendingConnectionModal: {
    sourceDeviceId: string;
    sourceInterfaceId: string;
    targetDeviceId: string;
    targetInterfaceId: string;
  };
  sourceDev: any;
  targetDev: any;
  sourceIface: any;
  targetIface: any;
}

const ConnectionModalDialog: React.FC<ConnectionModalDialogProps> = ({
  pendingConnectionModal,
  sourceDev,
  targetDev,
  sourceIface,
  targetIface,
}) => {
  const { setPendingConnectionModal, createLink, updateInterface } = useNetworkStore();

  const isBothSfp =
    (sourceIface.type === 'sfp' || sourceIface.type === 'sfp-plus') &&
    (targetIface.type === 'sfp' || targetIface.type === 'sfp-plus');

  const defaultMedia: MediaType = isBothSfp ? 'fiber-smf' : 'copper-cat6';

  const [mediaType, setMediaType] = useState<MediaType>(defaultMedia);
  const [cableLengthMeters, setCableLengthMeters] = useState<number>(isBothSfp ? 50 : 5);
  const [sourceTransceiver, setSourceTransceiver] = useState<OpticalTransceiverType>(
    sourceIface.transceiver || (isBothSfp ? 'sfpplus-10g-lr' : 'none')
  );
  const [targetTransceiver, setTargetTransceiver] = useState<OpticalTransceiverType>(
    targetIface.transceiver || (isBothSfp ? 'sfpplus-10g-lr' : 'none')
  );

  const { sourceDeviceId, sourceInterfaceId, targetDeviceId, targetInterfaceId } = pendingConnectionModal;


  const isFiber = mediaType === 'fiber-smf' || mediaType === 'fiber-mmf';

  // Compute live attenuation
  const cableSpec = CABLE_SPECIFICATIONS[mediaType];
  const lossDb =
    mediaType === 'fiber-smf'
      ? (cableLengthMeters / 1000) * 0.35 + 0.5
      : mediaType === 'fiber-mmf'
      ? (cableLengthMeters / 1000) * 3.0 + 0.5
      : (cableLengthMeters / 100) * 2.2;

  // Pre-flight check
  let warningMsg: string | null = null;
  if (isFiber && (sourceIface.type === 'ethernet' || targetIface.type === 'ethernet')) {
    warningMsg = 'Cannot connect optical fiber cable directly to an RJ45 Ethernet port!';
  } else if (!isFiber && isBothSfp && sourceTransceiver !== 'sfpplus-10g-rj45' && sourceTransceiver !== 'sfp-1g-rj45') {
    warningMsg = 'Connecting copper cable to SFP cage requires an RJ45 SFP copper module!';
  } else if (isFiber && mediaType === 'fiber-smf' && sourceTransceiver === 'sfpplus-10g-sr') {
    warningMsg = 'Multi-Mode SFP+ 10G SR transceiver cannot transmit over Single-Mode OS2 fiber!';
  }

  const handleEstablish = (e: React.FormEvent) => {
    e.preventDefault();

    // If transceivers chosen, update interface models
    if (isFiber || sourceTransceiver !== 'none') {
      updateInterface(sourceDeviceId, sourceInterfaceId, { transceiver: sourceTransceiver });
    }
    if (isFiber || targetTransceiver !== 'none') {
      updateInterface(targetDeviceId, targetInterfaceId, { transceiver: targetTransceiver });
    }

    createLink(
      sourceDeviceId,
      sourceInterfaceId,
      targetDeviceId,
      targetInterfaceId,
      mediaType,
      cableLengthMeters,
      sourceTransceiver,
      targetTransceiver
    );

    setPendingConnectionModal(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
          <Cable className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white">Physical Link Setup & Media Negotiation</h3>
        </div>

        {/* Endpoints Badge */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 mb-4 flex items-center justify-between text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Source Port</span>
            <span className="font-bold text-cyan-400">{sourceDev.name}</span>
            <span className="text-slate-300">{sourceIface.name} ({sourceIface.type})</span>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-600" />

          <div className="flex flex-col text-right">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Target Port</span>
            <span className="font-bold text-cyan-400">{targetDev.name}</span>
            <span className="text-slate-300">{targetIface.name} ({targetIface.type})</span>
          </div>
        </div>

        <form onSubmit={handleEstablish} className="space-y-4">
          {/* Media Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Cable & Physical Media
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="fiber-smf">Single-Mode Fiber OS2 9/125µm (Yellow Jacket, 1310/1550nm)</option>
              <option value="fiber-mmf">Multi-Mode Fiber OM3/OM4 50/125µm (Aqua Jacket, 850nm)</option>
              <option value="copper-cat6">Cat6 UTP Gigabit Copper Cable (RJ45, Max 100m)</option>
              <option value="copper-cat6a">Cat6A STP 10G Shielded Copper Cable (RJ45, Max 100m)</option>
              <option value="copper-cat5e">Cat5e UTP Standard Copper Patch Cord</option>
            </select>
          </div>

          {/* SFP Transceiver selections if applicable */}
          {(isFiber || sourceIface.type === 'sfp' || sourceIface.type === 'sfp-plus') && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Source Optic ({sourceDev.name})
                </label>
                <select
                  value={sourceTransceiver}
                  onChange={(e) => setSourceTransceiver(e.target.value as OpticalTransceiverType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="none">-- Empty Cage --</option>
                  <option value="sfpplus-10g-lr">10G SFP+ LR (SMF 1310nm 10km)</option>
                  <option value="sfpplus-10g-sr">10G SFP+ SR (MMF 850nm 300m)</option>
                  <option value="sfpplus-10g-bidi-u">10G BiDi Up (Tx1270/Rx1330 10km)</option>
                  <option value="sfpplus-10g-bidi-d">10G BiDi Down (Tx1330/Rx1270 10km)</option>
                  <option value="sfp-1g-lx">1G SFP LX (SMF 1310nm 10km)</option>
                  <option value="sfp-1g-sx">1G SFP SX (MMF 850nm 550m)</option>
                  <option value="sfpplus-10g-rj45">10G Copper S+RJ10 (RJ45)</option>
                  <option value="sfp-1g-rj45">1G Copper S-RJ01 (RJ45)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Target Optic ({targetDev.name})
                </label>
                <select
                  value={targetTransceiver}
                  onChange={(e) => setTargetTransceiver(e.target.value as OpticalTransceiverType)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="none">-- Empty Cage --</option>
                  <option value="sfpplus-10g-lr">10G SFP+ LR (SMF 1310nm 10km)</option>
                  <option value="sfpplus-10g-sr">10G SFP+ SR (MMF 850nm 300m)</option>
                  <option value="sfpplus-10g-bidi-d">10G BiDi Down (Tx1330/Rx1270 10km)</option>
                  <option value="sfpplus-10g-bidi-u">10G BiDi Up (Tx1270/Rx1330 10km)</option>
                  <option value="sfp-1g-lx">1G SFP LX (SMF 1310nm 10km)</option>
                  <option value="sfp-1g-sx">1G SFP SX (MMF 850nm 550m)</option>
                  <option value="sfpplus-10g-rj45">10G Copper S+RJ10 (RJ45)</option>
                  <option value="sfp-1g-rj45">1G Copper S-RJ01 (RJ45)</option>
                </select>
              </div>
            </div>
          )}

          {/* Cable Length & Attenuation */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-300">Cable Span Distance</span>
              <span className="font-mono text-cyan-400 font-bold">{cableLengthMeters} meters</span>
            </div>
            <input
              type="range"
              min="1"
              max={isFiber ? 10000 : 150}
              step={isFiber ? 10 : 1}
              value={cableLengthMeters}
              onChange={(e) => setCableLengthMeters(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
              <span>Estimated Optical/Channel Loss: {lossDb.toFixed(2)} dB</span>
              <span>Max Rated: {cableSpec.maxDistanceMeters}m</span>
            </div>
          </div>

          {/* Warning Banner if incompatible */}
          {warningMsg ? (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{warningMsg}</span>
            </div>
          ) : (
            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Layer 1 specifications physically compatible. Ready to link!</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPendingConnectionModal(null)}
              className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded shadow-md transition-colors"
            >
              Establish Physical Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const ConnectionModal: React.FC = () => {
  const { activeProject, pendingConnectionModal } = useNetworkStore();

  if (!pendingConnectionModal) return null;

  const { sourceDeviceId, sourceInterfaceId, targetDeviceId, targetInterfaceId } = pendingConnectionModal;

  const sourceDev = activeProject.devices.find((d) => d.id === sourceDeviceId);
  const targetDev = activeProject.devices.find((d) => d.id === targetDeviceId);
  const sourceIface = sourceDev?.interfaces.find((i) => i.id === sourceInterfaceId);
  const targetIface = targetDev?.interfaces.find((i) => i.id === targetInterfaceId);

  if (!sourceDev || !targetDev || !sourceIface || !targetIface) return null;

  return (
    <ConnectionModalDialog
      key={`${sourceDeviceId}:${sourceInterfaceId}-${targetDeviceId}:${targetInterfaceId}`}
      pendingConnectionModal={pendingConnectionModal}
      sourceDev={sourceDev}
      targetDev={targetDev}
      sourceIface={sourceIface}
      targetIface={targetIface}
    />
  );
};

