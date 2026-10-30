import React from 'react';
import { USE_CASES } from '../data/websiteContent';
import { Layers } from 'lucide-react';

export const UseCasesSection: React.FC = () => {
  return (
    <section
      id="use-cases"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 space-y-14">
        {/* Section Heading */}
        <div className="space-y-3 max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
            PRACTICAL SCENARIOS &amp; USE CASES
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Skenario Penggunaan NETLAB di Berbagai Skala Jaringan
          </h2>
          <p className="text-base text-slate-300 leading-relaxed">
            Dari laboratorium pembelajaran dasar hingga perencanaan topologi kampus dan sirkuit
            Metro Ethernet, NETLAB menyediakan peralatan yang relevan untuk memodelkan dan
            menguji setiap lapisan jaringan.
          </p>
        </div>

        {/* Use Case Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {USE_CASES.map((uc) => (
            <div
              key={uc.id}
              className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between gap-6 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-400 font-bold">{uc.code}</span>
                  <span className="text-slate-400 truncate max-w-[220px]">
                    {uc.targetAudience}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight">
                  {uc.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {uc.scenario}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/90 space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Modul Terkait:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {uc.keyModules.map((mod) => (
                    <span
                      key={mod}
                      className="text-[11px] font-mono text-slate-300 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded"
                    >
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
