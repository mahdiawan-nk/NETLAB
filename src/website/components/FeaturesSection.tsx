import React from 'react';
import { Check, ArrowUpRight } from 'lucide-react';
import { CORE_FEATURES } from '../data/websiteContent';
import {
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

export const FeaturesSection: React.FC = () => {
  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  return (
    <section
      id="features"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 space-y-14">
        {/* Section Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              CORE CAPABILITIES
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Fitur Inti yang Telah Berjalan di NETLAB
            </h2>
            <p className="text-base text-slate-300 leading-relaxed">
              Seluruh modul di bawah ini telah terintegrasi penuh di dalam NETLAB Workspace dan
              dapat langsung digunakan untuk merancang, mengonfigurasi, serta menguji topologi
              jaringan.
            </p>
          </div>

          <a
            href={getWorkspaceLaunchUrl()}
            onClick={handleLaunchWorkspace}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition-colors shrink-0 self-start md:self-auto"
          >
            <span>Coba Langsung di Workspace</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Asymmetric Bento Grid of Real Features */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {CORE_FEATURES.map((feature) => {
            const colSpanClass =
              feature.span === 'wide' ? 'lg:col-span-7' : 'lg:col-span-5';

            return (
              <div
                key={feature.id}
                className={`${colSpanClass} p-6 sm:p-8 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/75 flex flex-col justify-between gap-6 transition-colors`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800/90 pb-3">
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {feature.number}. {feature.subtitle}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {feature.title}
                  </h3>

                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <ul className="space-y-2.5 pt-2 border-t border-slate-800/80">
                  {feature.capabilities.map((cap, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300"
                    >
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
