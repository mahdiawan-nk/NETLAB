import React, { useState } from 'react';
import { DOCUMENTATION_TOPICS } from '../data/websiteContent';
import {
  BookOpen,
  CheckCircle2,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import {
  APP_CONFIG,
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

export const DocumentationSection: React.FC = () => {
  const [selectedDocId, setSelectedDocId] = useState<string>(
    DOCUMENTATION_TOPICS[0].id
  );

  const activeDoc =
    DOCUMENTATION_TOPICS.find((d) => d.id === selectedDocId) ||
    DOCUMENTATION_TOPICS[0];

  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  return (
    <section
      id="docs"
      className="py-20 md:py-28 border-b border-slate-800/80 bg-slate-950"
    >
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              PUBLIC DOCUMENTATION OVERVIEW
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Panduan Penggunaan &amp; Dokumentasi {APP_CONFIG.brandName}
            </h2>
            <p className="text-base text-slate-300 leading-relaxed">
              Ringkasan dokumentasi di bawah ini membantu Anda memahami konsep dasar, alur
              konfigurasi, serta batasan simulator sebelum membuka {APP_CONFIG.applicationName}.
              Panduan interaktif lengkap juga tersedia langsung di dalam aplikasi melalui tombol{' '}
              <strong className="text-white">User Guide</strong>.
            </p>
          </div>

          <a
            href={getWorkspaceLaunchUrl()}
            onClick={handleLaunchWorkspace}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-700 hover:border-cyan-500/50 bg-slate-900 text-slate-200 hover:text-white text-xs font-semibold transition-colors shrink-0 self-start md:self-auto"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Buka User Guide Lengkap di Workspace</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Documentation Master-Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Navigation List */}
          <div className="lg:col-span-4 space-y-2">
            {DOCUMENTATION_TOPICS.map((topic) => {
              const isSelected = topic.id === selectedDocId;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedDocId(topic.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-500/10 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                    {topic.category}
                  </div>
                  <div className="text-sm font-bold mt-1">{topic.title}</div>
                </button>
              );
            })}
          </div>

          {/* Right Detail Content */}
          <div className="lg:col-span-8 p-6 sm:p-8 rounded-xl border border-slate-800 bg-slate-900/80 space-y-6">
            <div className="space-y-2 border-b border-slate-800 pb-5">
              <div className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                {activeDoc.category}
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                {activeDoc.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed pt-1">
                {activeDoc.summary}
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-mono uppercase text-slate-400">
                Poin Panduan Utama:
              </div>
              <ul className="space-y-3">
                {activeDoc.bulletPoints.map((pt, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-800/90 bg-slate-950/60 text-sm text-slate-200 leading-relaxed"
                  >
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyan-950/20 flex items-start gap-3 text-xs sm:text-sm text-slate-300">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white">Tips Praktis: </span>
                Saat bekerja di dalam {APP_CONFIG.applicationName}, setiap modul utama (Topology
                Canvas, ISP Dashboard, Workload Manager, dan RouterOS Console) dilengkapi tombol
                bantuan kontekstual untuk membuka bab panduan yang relevan secara instan.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
