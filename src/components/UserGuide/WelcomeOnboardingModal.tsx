import React, { useState } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  Network,
  BookOpen,
  Rocket,
  Layers,
  Terminal,
  Activity,
  CheckCircle2,
  X,
} from 'lucide-react';

const ONBOARDING_STORAGE_KEY = 'netlab_onboarding_completed_v1';

export const WelcomeOnboardingModal: React.FC = () => {
  const { openUserGuide } = useNetworkStore();
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(ONBOARDING_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const markOnboardingSeen = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    setIsVisible(false);
  };

  const handleStartGuide = () => {
    markOnboardingSeen();
    openUserGuide('getting-started');
  };

  const handleSkipOrLater = () => {
    markOnboardingSeen();
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="netlab-welcome-title"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-cyan-500/30">
        {/* Top Accent Banner */}
        <div className="p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40 border-b border-slate-800 relative">
          <button
            type="button"
            onClick={handleSkipOrLater}
            title="Skip Introduction"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60 uppercase">
                Selamat Datang di NETLAB
              </span>
              <h2 id="netlab-welcome-title" className="text-lg font-bold text-white mt-0.5">
                Network Topology Designer & RouterOS Simulator
              </h2>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Rancang arsitektur jaringan fisik dengan akurasi port Ethernet & SFP/SFP+, konfigurasikan
            perangkat MikroTik melalui CLI atau Winbox GUI, kelola kapasitas ISP & CIR, serta uji
            beban trafik dan jalur paket secara interaktif.
          </p>
        </div>

        {/* Highlights */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">Dual-Block Interface Faceplate</div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Blok port Ethernet dan SFP/SFP+ terpisah dengan penarikan kabel port-ke-port.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
              <Terminal className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">MikroTik CLI & Winbox GUI</div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Konfigurasi RouterOS v6/v7 dua arah, Snapshot Backup, Config Diff & Export .rsc.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
              <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">WAN CIR & Workload Simulation</div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Uji kecukupan bandwidth, CIR, contention ratio, dan Packet Tracer hop-by-hop.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-white">30+ Automated Diagnostics</div>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Deteksi otomatis IP conflict, VLAN mismatch, loop, hingga saturasi link.
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-[11px] text-cyan-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Anda dapat membuka <strong>User Guide</strong> kapan saja melalui tombol di bagian
              atas layar (TopBar) atau ikon bantuan kontekstual di setiap modul.
            </span>
          </div>

          {/* 3 Action Buttons per Specification */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleSkipOrLater}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Skip Introduction
            </button>

            <button
              type="button"
              onClick={handleSkipOrLater}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Open User Guide Later
            </button>

            <button
              type="button"
              onClick={handleStartGuide}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/50 transition-all"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Start Guide</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
