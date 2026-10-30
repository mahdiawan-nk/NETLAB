import React from 'react';
import {
  ArrowUpRight,
  Compass,
  Terminal,
  Activity,
  CheckCircle2,
  Cpu,
  Layers,
} from 'lucide-react';
import {
  APP_CONFIG,
  WebsiteSectionId,
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

interface HeroSectionProps {
  onSelectSection: (section: WebsiteSectionId, path: string) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onSelectSection }) => {
  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  return (
    <section className="relative overflow-hidden border-b border-slate-800/80 pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Subtle architectural background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(51 65 85) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-cyan-500/10 blur-[130px] rounded-full" />

      <div className="relative max-w-[1360px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Column: Core Value Proposition & Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-cyan-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>NETWORK TOPOLOGY DESIGNER & SIMULATION PLATFORM</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-white leading-[1.08]">
              Rancang, Konfigurasi, dan Uji Topologi Jaringan Secara Virtual.
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-[62ch]">
              {APP_CONFIG.brandName} memadukan kanvas perancangan topologi berbasis port fisik,
              manajemen kapasitas ISP &amp; CIR, simulasi perjalanan paket L2/L3, diagnostik
              otomatis, serta konsol konfigurasi MikroTik RouterOS (CLI &amp; Winbox GUI) dalam
              satu ruang kerja terpadu.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <a
                href={getWorkspaceLaunchUrl()}
                onClick={handleLaunchWorkspace}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-tight transition-all shadow-lg shadow-cyan-500/15"
              >
                <span>Launch NETLAB</span>
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </a>

              <a
                href="/features"
                onClick={(e) => {
                  e.preventDefault();
                  onSelectSection('features', '/features');
                }}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-900/80 hover:bg-slate-900 text-slate-200 font-semibold text-sm transition-colors"
              >
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Explore Features</span>
              </a>
            </div>

            {/* Domain Architecture Indicator */}
            <div className="pt-4 border-t border-slate-800/90 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-mono uppercase">Dual-Block Faceplate</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  Block A Ethernet &amp; Block B SFP+
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-mono uppercase">RouterOS Engine</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  CLI, Winbox GUI &amp; .rsc v6/v7
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-mono uppercase">Simulation &amp; Audit</div>
                <div className="text-slate-200 font-semibold mt-0.5">
                  Packet Tracer, CIR &amp; Diagnostics
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentic Interactive Architecture Schematic Preview */}
          <div className="lg:col-span-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/95 shadow-2xl overflow-hidden">
              {/* Simulated Workspace Window Header */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                  <span className="ml-2 text-xs font-mono text-slate-400">
                    {APP_CONFIG.applicationDomain.replace(/^https?:\/\//, '')} — Workspace Preview
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Topology Valid (RUN)</span>
                </div>
              </div>

              {/* Workspace Visual Diagram */}
              <div className="p-5 space-y-4 bg-slate-950/60">
                {/* Upstream ISP Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/90 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-cyan-400">
                        UPSTREAM WAN CIRCUIT #1
                      </div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        Metro-E Dedicated Fiber
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        MIR: 500 Mbps | CIR: 500 Mbps (1:1)
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded">
                      LINK UP
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/90 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-amber-400">
                        BACKUP BROADBAND WAN #2
                      </div>
                      <div className="text-xs font-bold text-white mt-0.5">
                        FTTX Business Failover
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        MIR: 300 Mbps | CIR: 75 Mbps (1:4)
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-cyan-300 border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 rounded">
                      STANDBY
                    </span>
                  </div>
                </div>

                {/* Authentic Dual-Block Device Faceplate Card Representation */}
                <div className="p-4 rounded-lg border border-cyan-500/30 bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="w-4 h-4 text-cyan-400" />
                      <div>
                        <div className="text-xs font-bold text-white">
                          CORE-GW-CCR2004 (MikroTik RouterOS v7)
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          10.0.0.1/24 • VLAN 10, 20, 30, 99 • NAT Active
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">
                      STATUS: RUN
                    </span>
                  </div>

                  {/* Dual Block Faceplate Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                    {/* BLOCK A: Ethernet Interfaces */}
                    <div className="md:col-span-8 p-2.5 rounded border border-slate-800 bg-slate-950/90">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          BLOCK A — ETHERNET INTERFACES (8 PORTS)
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">1G RJ45</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['ether1', 'ether2', 'ether3', 'ether4', 'ether5', 'ether6', 'ether7', 'ether8'].map(
                          (port, idx) => {
                            const active = idx < 5;
                            return (
                              <div
                                key={port}
                                className={`px-2 py-1.5 rounded border text-center font-mono text-[10px] ${
                                  active
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                    : 'border-slate-800 bg-slate-900 text-slate-500'
                                }`}
                              >
                                <div className="flex items-center justify-center gap-1">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      active ? 'bg-emerald-400' : 'bg-slate-700'
                                    }`}
                                  />
                                  <span>{port}</span>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* BLOCK B: SFP / SFP+ Interfaces */}
                    <div className="md:col-span-4 p-2.5 rounded border border-cyan-500/30 bg-slate-950/90">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                          BLOCK B — SFP+
                        </span>
                        <span className="text-[10px] font-mono text-amber-400">10G OPTIC</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {['sfp-sfpplus1', 'sfp-sfpplus2', 'sfp-sfpplus3', 'sfp-sfpplus4'].map(
                          (port, idx) => {
                            const active = idx < 2;
                            return (
                              <div
                                key={port}
                                className={`px-1.5 py-1.5 rounded border text-center font-mono text-[10px] truncate ${
                                  active
                                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                                    : 'border-slate-800 bg-slate-900 text-slate-500'
                                }`}
                              >
                                {port.replace('sfp-sfpplus', 'sfp+')}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Simulation & CLI Bottom Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/90 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400">
                      <Activity className="w-3.5 h-3.5" />
                      <span>PACKET TRACER &amp; TRAFFIC ENGINE</span>
                    </div>
                    <div className="text-xs font-mono text-slate-300">
                      10.10.20.15 → 8.8.8.8 (TCP:443)
                    </div>
                    <div className="text-[11px] font-mono text-emerald-400">
                      4 Hops • VLAN 20 Tagged • Src-NAT Masquerade • DELIVERED
                    </div>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/90 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400">
                      <Terminal className="w-3.5 h-3.5" />
                      <span>ROUTEROS CLI &amp; .RSC GENERATOR</span>
                    </div>
                    <div className="text-xs font-mono text-slate-300 truncate">
                      /ip firewall nat add chain=srcnat action=masquerade
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-cyan-400" />
                      <span>Synced with Winbox GUI • v6/v7 Compatible</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
