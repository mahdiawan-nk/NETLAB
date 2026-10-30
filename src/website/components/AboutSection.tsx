import React from 'react';
import {
  ShieldAlert,
  Cpu,
  Sliders,
  FileCode2,
  CheckCircle2,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/appConfig';

export const AboutSection: React.FC = () => {
  return (
    <section
      id="about"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 space-y-16">
        {/* Section Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              ABOUT {APP_CONFIG.brandName}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
              Lingkungan Perancangan dan Validasi Jaringan Sebelum Implementasi Fisik.
            </h2>
          </div>

          <div className="lg:col-span-7 space-y-4 text-slate-300 text-base leading-relaxed">
            <p>
              <strong className="text-white font-semibold">{APP_CONFIG.brandName}</strong> adalah
              aplikasi perancangan topologi jaringan komputer (Network Topology Designer) dan
              simulator jaringan (Network Simulation) yang dibangun untuk menjembatani tahap
              gambar diagram statis menuju kesiapan konfigurasi perangkat nyata.
            </p>
            <p>
              Dalam banyak proyek infrastruktur, diagram jaringan sering kali hanya berupa gambar
              visual tanpa kesadaran terhadap kapasitas sirkuit ISP, aturan tag VLAN pada port
              switch, tabel routing, maupun beban trafik dari perangkat endpoint. {APP_CONFIG.brandName}{' '}
              mengubah diagram tersebut menjadi model interaktif yang dapat diuji, diaudit, dan
              diekspor menjadi konfigurasi perangkat MikroTik RouterOS.
            </p>
          </div>
        </div>

        {/* 4 Core Pillars: Problems Solved & Engineering Value */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Masalah yang Diselesaikan
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Mencegah kesalahan umum sebelum instalasi lapangan seperti konflik subnet IP,
              ketidakcocokan VLAN PVID pada port trunk/access, ketiadaan default route, serta
              bottleneck bandwidth upstream ISP.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Representasi Port Presisi
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Menampilkan faceplate perangkat dengan pemisahan nyata antara Block A (Ethernet RJ45)
              dan Block B (Optical SFP/SFP+/QSFP) sehingga alokasi kabel fisik dapat direncanakan
              secara akurat per port.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Simulasi Kapasitas &amp; CIR
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Mengukur bagaimana beban kerja nyata dari klien dan server (Device Workload)
              memengaruhi utilisasi link lokal maupun sirkuit WAN ISP dengan memperhitungkan
              Committed Information Rate (CIR).
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Kesiapan Konfigurasi MikroTik
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Menyediakan konsol manajemen dua arah (Winbox-like GUI dan terminal CLI) lengkap
              dengan fitur Backup/Restore, Config Diff, serta generator script `.rsc` untuk
              RouterOS v6 dan v7.
            </p>
          </div>
        </div>

        {/* Target Users Banner */}
        <div className="p-6 md:p-8 rounded-xl border border-slate-800 bg-slate-900/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              DIRANCANG UNTUK KEBUTUHAN AKADEMIK &amp; TEKNIS LAPANGAN
            </div>
            <h3 className="text-xl font-bold text-white">
              Satu Platform untuk Belajar, Merancang Arsitektur, dan Menguji Konfigurasi
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-300 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Mahasiswa &amp; Pelajar Jaringan Komputer</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Network Administrator &amp; IT Support</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Network Engineer &amp; System Integrator</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Perancang Jaringan Kampus, UMKM &amp; ISP</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
