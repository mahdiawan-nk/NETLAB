import React, { useState } from 'react';
import { PREVIEW_MODULES } from '../data/websiteContent';
import {
  CheckCircle2,
  ArrowUpRight,
  Network,
  Cpu,
  Globe,
  Activity,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  APP_CONFIG,
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

export const ProductPreviewSection: React.FC = () => {
  const [activeTabId, setActiveTabId] = useState<string>(PREVIEW_MODULES[0].id);
  const activeModule =
    PREVIEW_MODULES.find((m) => m.id === activeTabId) || PREVIEW_MODULES[0];

  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  return (
    <section
      id="preview"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              INTERACTIVE PRODUCT PREVIEW
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Tampilan Modul di Dalam {APP_CONFIG.applicationName}
            </h2>
            <p className="text-base text-slate-300 leading-relaxed">
              Pilih modul di bawah ini untuk meninjau cara kerja antarmuka pengguna dan struktur
              visual yang tersedia pada domain aplikasi ({APP_CONFIG.applicationDomain}).
            </p>
          </div>

          <a
            href={getWorkspaceLaunchUrl()}
            onClick={handleLaunchWorkspace}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors self-start md:self-auto"
          >
            <span>Buka Workspace Interaktif</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Module Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PREVIEW_MODULES.map((mod) => {
            const isSelected = mod.id === activeTabId;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => setActiveTabId(mod.id)}
                className={`px-3.5 py-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-500/10 text-white'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-mono font-semibold truncate">
                  {mod.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview Panel Body */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Description Column */}
          <div className="lg:col-span-5 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                {activeModule.badge}
              </div>

              <h3 className="text-2xl font-bold text-white tracking-tight">
                {activeModule.title}
              </h3>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                {activeModule.description}
              </p>

              <div className="pt-3 space-y-2.5">
                {activeModule.highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Status Modul: Aktif di Workspace</span>
              <a
                href={getWorkspaceLaunchUrl()}
                onClick={handleLaunchWorkspace}
                className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1"
              >
                <span>Launch</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Live Schematic Preview Column */}
          <div className="lg:col-span-7 p-6 sm:p-8 bg-slate-950/80 flex flex-col justify-center">
            {activeTabId === 'topology' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Network className="w-4 h-4" />
                    CANVAS TOPOLOGY VIEWPORT (ZOOM: 100%)
                  </span>
                  <span className="text-emerald-400">3 NODES • 2 LINKS ACTIVE</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center py-4">
                  <div className="p-3.5 rounded-lg border border-slate-700 bg-slate-900 space-y-1.5">
                    <div className="text-[10px] font-mono text-cyan-400">CORE ROUTER</div>
                    <div className="text-xs font-bold text-white">RTR-CORE-01</div>
                    <div className="text-[11px] font-mono text-slate-400">CCR2004-1G-12S+2XS</div>
                    <div className="text-[10px] font-mono text-emerald-400 pt-1">
                      sfp-sfpplus1 ↔ 10G SMF
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-cyan-500/40 bg-slate-900 space-y-1.5">
                    <div className="text-[10px] font-mono text-cyan-400">DISTRIBUTION SWITCH</div>
                    <div className="text-xs font-bold text-white">SW-DIST-01</div>
                    <div className="text-[11px] font-mono text-slate-400">CRS326-24G-2S+RM</div>
                    <div className="text-[10px] font-mono text-cyan-300 pt-1">
                      Trunk VLAN 10, 20, 30
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-700 bg-slate-900 space-y-1.5">
                    <div className="text-[10px] font-mono text-emerald-400">APPLICATION SERVER</div>
                    <div className="text-xs font-bold text-white">SRV-ERP-PROD</div>
                    <div className="text-[11px] font-mono text-slate-400">10.10.10.50/24</div>
                    <div className="text-[10px] font-mono text-slate-300 pt-1">
                      eth0 ↔ ether5 (Access VLAN 10)
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 text-xs font-mono text-slate-300 flex flex-wrap items-center justify-between gap-2">
                  <span>Media Legend:</span>
                  <span className="text-blue-400">■ Copper UTP (1G)</span>
                  <span className="text-amber-400">■ Fiber SMF (10G)</span>
                  <span className="text-cyan-400">■ Fiber MMF (10G)</span>
                </div>
              </div>
            )}

            {activeTabId === 'faceplate' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Cpu className="w-4 h-4" />
                    DEVICE FACEPLATE UI — CRS326-24G-2S+RM
                  </span>
                  <span>24 ETHERNET + 2 SFP+</span>
                </div>

                <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 space-y-4">
                  {/* Block A */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-300 font-bold">
                        BLOCK A — ETHERNET INTERFACES (12 COLUMNS × 2 ROWS)
                      </span>
                      <span className="text-emerald-400">RJ45 1G</span>
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((num) => (
                        <div
                          key={num}
                          className={`py-1.5 rounded border text-center font-mono text-[10px] ${
                            num <= 8
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-800 bg-slate-950 text-slate-500'
                          }`}
                        >
                          e{num}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Block B */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-cyan-300 font-bold">
                        BLOCK B — SFP / SFP+ INTERFACES (SEPARATE OPTICAL BLOCK)
                      </span>
                      <span className="text-amber-400">10G SFP+</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-xs">
                      {['sfp-sfpplus1', 'sfp-sfpplus2'].map((p) => (
                        <div
                          key={p}
                          className="px-2.5 py-1.5 rounded border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 font-mono text-[10px] text-center"
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTabId === 'isp-cir' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Globe className="w-4 h-4" />
                    ISP &amp; WAN CIRCUIT SLA CONFIGURATION
                  </span>
                  <span className="text-emerald-400">CPE WAN MAPPED</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold">ISP-A Dedicated Metro</span>
                      <span className="text-emerald-400 text-[10px]">STATE: UP</span>
                    </div>
                    <div className="text-slate-400">Download MIR: 200 Mbps</div>
                    <div className="text-emerald-300">Download CIR: 200 Mbps (1:1 SLA)</div>
                    <div className="text-slate-400">Mapped Port: RTR-CORE-01 → sfp-sfpplus1</div>
                  </div>

                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold">ISP-B Broadband SOHO</span>
                      <span className="text-amber-400 text-[10px]">STATE: DEGRADED</span>
                    </div>
                    <div className="text-slate-400">Download MIR: 100 Mbps</div>
                    <div className="text-amber-300">Download CIR: 25 Mbps (1:4 Shared)</div>
                    <div className="text-slate-400">Mapped Port: RTR-CORE-01 → ether1</div>
                  </div>
                </div>
              </div>
            )}

            {activeTabId === 'simulation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Activity className="w-4 h-4" />
                    END-TO-END PACKET TRACE (ICMP ECHO)
                  </span>
                  <span className="text-emerald-400">STATUS: DELIVERED</span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {[
                    {
                      hop: 'HOP 1',
                      node: 'PC-STAFF-01 (192.168.10.25)',
                      detail: 'Egress eth0 → Access VLAN 10',
                    },
                    {
                      hop: 'HOP 2',
                      node: 'SW-ACCESS-01 (CRS326)',
                      detail: 'Ingress ether2 (PVID 10) → Egress sfp-sfpplus1 (802.1Q Tagged VLAN 10)',
                    },
                    {
                      hop: 'HOP 3',
                      node: 'RTR-CORE-01 (192.168.10.1)',
                      detail: 'Inter-VLAN Route Lookup → Forwarded to 10.10.10.0/24 via ether3',
                    },
                    {
                      hop: 'HOP 4',
                      node: 'SRV-ERP-PROD (10.10.10.50)',
                      detail: 'ICMP Echo Reply Generated • Total RTT: 1.8 ms',
                    },
                  ].map((item) => (
                    <div
                      key={item.hop}
                      className="p-2.5 rounded border border-slate-800 bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                    >
                      <span className="text-cyan-400 font-bold">
                        {item.hop}: <span className="text-white">{item.node}</span>
                      </span>
                      <span className="text-slate-400 text-[11px]">{item.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTabId === 'diagnostics' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <ShieldCheck className="w-4 h-4" />
                    TOPOLOGY VALIDATION &amp; DIAGNOSTICS ENGINE
                  </span>
                  <span className="text-amber-400">AUDITED IN REAL TIME</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10 space-y-1">
                    <div className="text-rose-300 font-bold">
                      [ERROR] IP_SUBNET_CONFLICT — Duplicate IP Detected
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      192.168.10.1/24 digunakan bersama pada RTR-CORE-01 (vlan10) dan SW-MGMT (ether1).
                    </div>
                  </div>

                  <div className="p-3 rounded border border-amber-500/30 bg-amber-500/10 space-y-1">
                    <div className="text-amber-300 font-bold">
                      [WARNING] VLAN_TRUNK_MISMATCH — Missing Allowed VLAN ID
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      Link trunk antara SW-DIST-01 dan SW-ACCESS-02 belum mengizinkan VLAN 30.
                    </div>
                  </div>

                  <div className="p-3 rounded border border-emerald-500/30 bg-emerald-500/10 space-y-1">
                    <div className="text-emerald-300 font-bold">
                      [PASS] ROUTEROS_V7_COMPATIBILITY — Syntax Validated
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      Seluruh aturan Bridge VLAN Filtering dan routing kompatibel dengan RouterOS v7.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTabId === 'mikrotik-cli' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2 text-cyan-400">
                    <Terminal className="w-4 h-4" />
                    MIKROTIK ROUTEROS CLI &amp; .RSC EXPORT
                  </span>
                  <span className="text-emerald-400">GUI ↔ CLI SYNCED</span>
                </div>

                <div className="p-4 rounded-lg border border-slate-800 bg-slate-900 font-mono text-xs space-y-1.5 text-slate-200 overflow-x-auto">
                  <div className="text-slate-500">
                    # Generated by NETLAB RouterOS Configuration Engine (v7)
                  </div>
                  <div>
                    <span className="text-cyan-400">/system identity</span> set name=&quot;RTR-CORE-01&quot;
                  </div>
                  <div>
                    <span className="text-cyan-400">/interface bridge</span> add name=br-lan vlan-filtering=yes
                  </div>
                  <div>
                    <span className="text-cyan-400">/ip address</span> add address=10.10.10.1/24 interface=vlan10-staff
                  </div>
                  <div>
                    <span className="text-cyan-400">/ip firewall nat</span> add chain=srcnat out-interface=sfp-sfpplus1 action=masquerade
                  </div>
                  <div>
                    <span className="text-cyan-400">/queue simple</span> add name=&quot;limit-guest-wifi&quot; target=192.168.99.0/24 max-limit=50M/50M
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
