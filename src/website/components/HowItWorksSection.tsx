import React from 'react';
import { HOW_IT_WORKS_STEPS } from '../data/websiteContent';

export const HowItWorksSection: React.FC = () => {
  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 space-y-14">
        {/* Section Heading */}
        <div className="space-y-3 max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
            ENGINEERING WORKFLOW
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Cara Kerja NETLAB dalam 6 Langkah Terstruktur
          </h2>
          <p className="text-base text-slate-300 leading-relaxed">
            Alur penggunaan dirancang mengikuti tahapan kerja nyata seorang Network Engineer saat
            menyusun desain topologi hingga memvalidasi kesiapan konfigurasi perangkat.
          </p>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {HOW_IT_WORKS_STEPS.map((item) => (
            <div
              key={item.step}
              className="p-6 rounded-xl border border-slate-800 bg-slate-900/70 flex flex-col justify-between gap-6"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-2xl font-mono font-extrabold text-cyan-400">
                    {item.step}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    STEP {item.step} / 06
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white tracking-tight pt-1">
                  {item.title}
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-xs font-mono text-cyan-300">
                Modul: {item.moduleRef}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
