import React, { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '../../store/useNetworkStore';
import {
  USER_GUIDE_SECTIONS,
  USER_GUIDE_MAP,
  GUIDE_CATEGORIES,
  searchUserGuide,
} from '../../data/userGuideRegistry';
import { GuideSectionId } from '../../types/userGuide';
import {
  BookOpen,
  Search,
  X,
  Rocket,
  Layers,
  Compass,
  Network,
  Server,
  Cable,
  Globe,
  Gauge,
  Users,
  Activity,
  BarChart3,
  Stethoscope,
  FileText,
  Terminal,
  Code2,
  GitCompare,
  Download,
  Wrench,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lightbulb,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Rocket,
  Layers,
  Compass,
  Network,
  Server,
  Cable,
  Globe,
  Gauge,
  Users,
  Activity,
  BarChart3,
  Stethoscope,
  FileText,
  Terminal,
  Code2,
  GitCompare,
  Download,
  Wrench,
  HelpCircle,
};

export const UserGuideModal: React.FC = () => {
  const {
    userGuideState,
    closeUserGuide,
    setUserGuideSection,
    setUserGuideSearchQuery,
  } = useNetworkStore();

  const [copiedCodeIdx, setCopiedCodeIdx] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { isOpen, activeSection, searchQuery } = userGuideState;

  // Scroll to top when active section changes
  useEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  // Keyboard accessibility (Escape to close, Ctrl/Cmd + K inside modal to focus search)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeUserGuide();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeUserGuide]);

  if (!isOpen) return null;

  const currentSection = USER_GUIDE_MAP[activeSection] || USER_GUIDE_SECTIONS[0];
  const currentIndex = USER_GUIDE_SECTIONS.findIndex((s) => s.id === currentSection.id);
  const prevSection = currentIndex > 0 ? USER_GUIDE_SECTIONS[currentIndex - 1] : null;
  const nextSection =
    currentIndex < USER_GUIDE_SECTIONS.length - 1
      ? USER_GUIDE_SECTIONS[currentIndex + 1]
      : null;

  const searchResults = searchQuery.trim() ? searchUserGuide(searchQuery) : [];
  const SectionIcon = ICON_MAP[currentSection.iconName] || BookOpen;

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCodeIdx(id);
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  const handleSelectSection = (id: GuideSectionId) => {
    setUserGuideSection(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="netlab-user-guide-title"
    >
      <div className="flex flex-col w-full max-w-7xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-cyan-500/20">
        {/* ========================================================= */}
        {/* MODAL HEADER (STICKY)                                     */}
        {/* ========================================================= */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="ToggleDaftar Modul Panduan"
            >
              <BookOpen className="w-4 h-4 text-cyan-400" />
            </button>

            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hidden sm:flex">
              <BookOpen className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="netlab-user-guide-title"
                  className="text-sm sm:text-base font-bold text-white tracking-tight"
                >
                  NETLAB User Guide
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60 uppercase">
                  Application Help Center
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Panduan Penggunaan, Konfigurasi Perangkat MikroTik, Kapasitas WAN/CIR, Simulasi & Troubleshooting
              </p>
            </div>
          </div>

          {/* Search Input & Close Button */}
          <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
            <div className="relative w-full sm:w-72 md:w-84">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setUserGuideSearchQuery(e.target.value)}
                placeholder="Cari modul, VLAN, CIR, CLI, error... (Ctrl+K)"
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-500 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setUserGuideSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title="Bersihkan Pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={closeUserGuide}
              title="Tutup User Guide (Esc)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-semibold transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
              <span className="hidden md:inline">Close</span>
            </button>
          </div>
        </header>

        {/* ========================================================= */}
        {/* MODAL BODY: LEFT SIDEBAR + RIGHT SCROLLABLE CONTENT       */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* LEFT NAVIGATION SIDEBAR */}
          <aside
            className={`${
              mobileSidebarOpen ? 'absolute inset-y-0 left-0 z-40 flex' : 'hidden'
            } lg:flex flex-col w-72 bg-slate-950/95 border-r border-slate-800/90 overflow-y-auto shrink-0`}
          >
            <div className="p-3 space-y-4">
              {GUIDE_CATEGORIES.map((group) => (
                <div key={group.name} className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                    {group.name}
                  </div>
                  {group.sections.map((sec) => {
                    const IconComp = ICON_MAP[sec.iconName] || BookOpen;
                    const isActive = sec.id === activeSection && !searchQuery.trim();
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => handleSelectSection(sec.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-all group ${
                          isActive
                            ? 'bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/40 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/90 border border-transparent'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-slate-900 text-slate-400 group-hover:text-cyan-400'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono opacity-60">{sec.number}.</span>
                            <span className="truncate">{sec.title}</span>
                          </div>
                        </div>
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          {/* RIGHT CONTENT AREA */}
          <div
            ref={contentScrollRef}
            className="flex-1 overflow-y-auto bg-slate-900/95 p-4 sm:p-6 md:p-8 select-text"
          >
            {/* ===================================================== */}
            {/* SEARCH RESULTS VIEW (WHEN SEARCH QUERY IS ACTIVE)     */}
            {/* ===================================================== */}
            {searchQuery.trim() ? (
              <div className="max-w-4xl mx-auto space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Search className="w-4 h-4 text-cyan-400" />
                      <span>Hasil Pencarian Panduan: "{searchQuery}"</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ditemukan {searchResults.length} topik relevan di seluruh modul panduan NETLAB.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUserGuideSearchQuery('')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium"
                  >
                    Kembali ke Modul Aktif
                  </button>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-950/70 border border-slate-800 text-center space-y-2">
                    <HelpCircle className="w-8 h-8 text-slate-500 mx-auto" />
                    <div className="text-sm font-semibold text-slate-300">
                      Tidak ditemukan hasil untuk "{searchQuery}"
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Coba gunakan kata kunci teknis seperti <code className="text-cyan-400">VLAN</code>,{' '}
                      <code className="text-cyan-400">SFP</code>, <code className="text-cyan-400">CIR</code>,{' '}
                      <code className="text-cyan-400">Bridge</code>, <code className="text-cyan-400">NAT</code>,{' '}
                      atau <code className="text-cyan-400">Winbox</code>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {searchResults.map((res, idx) => (
                      <button
                        key={`${res.sectionId}-${idx}`}
                        type="button"
                        onClick={() => handleSelectSection(res.sectionId)}
                        className="w-full text-left p-4 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                              {res.sectionTitle}
                            </span>
                            <span className="text-[11px] font-semibold text-amber-300">
                              {res.matchType}
                            </span>
                          </div>
                          <span className="text-xs text-cyan-400 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <span>Buka Panduan</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                          {res.snippet}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ===================================================== */
              /* 9-PART STRUCTURED GUIDE SECTION CONTENT               */
              /* ===================================================== */
              <div className="max-w-4xl mx-auto space-y-7 pb-10">
                {/* 1. TITLE & HEADER BANNER */}
                <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/25 border border-slate-800/90 shadow-lg">
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-2">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                      MODUL {currentSection.number} / 19
                    </span>
                    <span>•</span>
                    <span className="text-slate-400 uppercase">{currentSection.category}</span>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="p-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shrink-0 mt-0.5">
                      <SectionIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                        {currentSection.title}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                        {currentSection.subtitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* SIMULATION / IMPLEMENTATION NOTICE IF PRESENT */}
                {currentSection.simulationNotice && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/90 leading-relaxed">
                      <strong className="text-amber-300 font-semibold block mb-0.5">
                        Catatan Implementasi & Batasan Simulator:
                      </strong>
                      {currentSection.simulationNotice}
                    </div>
                  </div>
                )}

                {/* 2. DESCRIPTION & 3. PURPOSE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                      <Info className="w-4 h-4" />
                      <span>2. Deskripsi Modul</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {currentSection.description}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                      <span>3. Tujuan Penggunaan (Purpose)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {currentSection.purpose}
                    </p>
                  </div>
                </div>

                {/* 4. AVAILABLE FEATURES */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                    <span>4. Fitur yang Tersedia (Available Features)</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentSection.availableFeatures.map((feat, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-white">{feat.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold shrink-0 ${
                              feat.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {feat.status === 'active' ? 'AKTIF' : 'SIMULASI'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 5. STEP-BY-STEP INSTRUCTIONS */}
                <section className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Rocket className="w-4 h-4 text-cyan-400" />
                    <span>5. Panduan Langkah demi Langkah (Step-by-Step Instructions)</span>
                  </h3>
                  <div className="space-y-2.5">
                    {currentSection.steps.map((step) => (
                      <div
                        key={step.stepNumber}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-start gap-3.5"
                      >
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {step.stepNumber}
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white">{step.title}</h4>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                            {step.description}
                          </p>
                          {step.tip && (
                            <div className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-200 flex items-center gap-2">
                              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{step.tip}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SPECIALIZED TECHNICAL TABLES (IF PRESENT) */}
                {currentSection.technicalTables && currentSection.technicalTables.length > 0 && (
                  <section className="space-y-4">
                    {currentSection.technicalTables.map((tbl, tIdx) => (
                      <div
                        key={tIdx}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-xs font-bold text-cyan-300">
                          {tbl.title}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-900/70 text-slate-400 font-mono text-[10.5px] uppercase">
                                {tbl.headers.map((h, hIdx) => (
                                  <th key={hIdx} className="py-2.5 px-3.5 font-semibold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/70">
                              {tbl.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-slate-900/40">
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`py-2.5 px-3.5 align-top leading-relaxed whitespace-pre-line ${
                                        cIdx === 0
                                          ? 'font-semibold text-white whitespace-nowrap'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {/* SPECIALIZED CLI COMMAND REFERENCE (IF PRESENT) */}
                {currentSection.cliCommands && currentSection.cliCommands.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                      <Terminal className="w-4 h-4" />
                      <span>Daftar Perintah CLI yang Didukung Secara Aktual</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {currentSection.cliCommands.map((cmd, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {cmd.command}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                              {cmd.context}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">{cmd.description}</p>
                          <div className="relative">
                            <pre className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-cyan-200 overflow-x-auto">
                              {cmd.syntax}
                            </pre>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(cmd.syntax, `cli-${idx}`)}
                              className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] flex items-center gap-1"
                              title="Salin contoh perintah"
                            >
                              {copiedCodeIdx === `cli-${idx}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* SPECIALIZED CODE / RSC SCRIPT EXAMPLES (IF PRESENT) */}
                {currentSection.codeExamples && currentSection.codeExamples.length > 0 && (
                  <section className="space-y-3">
                    {currentSection.codeExamples.map((ex, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-white">{ex.title}</h4>
                            {ex.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{ex.description}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(ex.code, `code-${idx}`)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-colors shrink-0"
                          >
                            {copiedCodeIdx === `code-${idx}` ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Script</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="p-4 text-[11.5px] font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                          {ex.code}
                        </pre>
                      </div>
                    ))}
                  </section>
                )}

                {/* SPECIALIZED 13 TROUBLESHOOTING CARDS (IF PRESENT) */}
                {currentSection.troubleshootingCards &&
                  currentSection.troubleshootingCards.length > 0 && (
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        <span>13 Skenario Pemeriksaan & Perbaikan Masalah (Troubleshooting Playbook)</span>
                      </h3>
                      <div className="space-y-3.5">
                        {currentSection.troubleshootingCards.map((card) => (
                          <div
                            key={card.id}
                            className="p-4 sm:p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3"
                          >
                            <div className="flex items-center gap-2.5 border-b border-slate-800/80 pb-2.5">
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold">
                                KASUS #{card.number}
                              </span>
                              <h4 className="text-sm font-bold text-white">{card.title}</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-1">
                                <span className="font-bold text-rose-300 block uppercase text-[10px] font-mono">
                                  1. Gejala (Symptom)
                                </span>
                                <p className="text-slate-300 leading-relaxed">{card.symptom}</p>
                              </div>

                              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/25 space-y-1">
                                <span className="font-bold text-amber-300 block uppercase text-[10px] font-mono">
                                  2. Kemungkinan Penyebab (Probable Cause)
                                </span>
                                <p className="text-slate-300 leading-relaxed">{card.probableCause}</p>
                              </div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1">
                              <span className="font-bold text-cyan-300 block uppercase text-[10px] font-mono">
                                3. Cara Pemeriksaan (Inspection Method)
                              </span>
                              <p className="text-slate-300 leading-relaxed">{card.inspectionMethod}</p>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-950/15 border border-emerald-500/25 text-xs space-y-1.5">
                              <span className="font-bold text-emerald-300 block uppercase text-[10px] font-mono">
                                4. Langkah Perbaikan (Remediation Steps)
                              </span>
                              <ul className="list-disc list-inside space-y-1 text-slate-200">
                                {card.remediationSteps.map((st, sIdx) => (
                                  <li key={sIdx} className="leading-relaxed">
                                    {st}
                                  </li>
                                ))}
                              </ul>
                              <div className="pt-1.5 mt-1.5 border-t border-emerald-500/20 text-[11px] text-emerald-200">
                                <strong>5. Hasil yang Diharapkan:</strong> {card.expectedOutcome}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                {/* SPECIALIZED FAQ ITEMS (IF PRESENT) */}
                {currentSection.faqItems && currentSection.faqItems.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4" />
                      <span>Pertanyaan yang Sering Diajukan (FAQ)</span>
                    </h3>
                    <div className="space-y-3">
                      {currentSection.faqItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white">
                              Q: {item.question}
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300 shrink-0">
                              {item.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 6. EXPECTED RESULTS & 7. TIPS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-950/15 border border-emerald-500/30 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>6. Hasil yang Diharapkan (Expected Results)</span>
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {currentSection.expectedResults.map((res, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{res}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                      <span>7. Tips Praktis (Best Practices)</span>
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {currentSection.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-cyan-400 font-bold">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 8. COMMON PROBLEMS */}
                {currentSection.commonProblems.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>8. Masalah Umum pada Modul Ini (Common Problems)</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {currentSection.commonProblems.map((prob, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/25 space-y-1.5 text-xs"
                        >
                          <div className="font-bold text-amber-300">{prob.problem}</div>
                          <div className="text-slate-400">
                            <strong className="text-slate-300">Penyebab:</strong> {prob.cause}
                          </div>
                          <div className="text-emerald-300">
                            <strong>Solusi:</strong> {prob.solution}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 9. RELATED GUIDES & PREV/NEXT FOOTER */}
                <section className="pt-4 border-t border-slate-800 space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      9. Panduan Terkait (Related Guides)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {currentSection.relatedGuides.map((relId) => {
                        const relSec = USER_GUIDE_MAP[relId];
                        if (!relSec) return null;
                        return (
                          <button
                            key={relId}
                            type="button"
                            onClick={() => handleSelectSection(relId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-200 hover:text-cyan-300 transition-colors"
                          >
                            <span className="font-mono text-[10px] text-cyan-400">
                              {relSec.number}.
                            </span>
                            <span>{relSec.title}</span>
                            <ArrowRight className="w-3 h-3 opacity-70" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Prev / Next Navigation Buttons */}
                  <div className="flex items-center justify-between gap-4 pt-2">
                    {prevSection ? (
                      <button
                        type="button"
                        onClick={() => handleSelectSection(prevSection.id)}
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <div className="text-[10px] font-mono text-slate-500 uppercase">
                            Sebelumnya
                          </div>
                          <div className="text-xs font-semibold text-slate-200">
                            {prevSection.number}. {prevSection.title}
                          </div>
                        </div>
                      </button>
                    ) : (
                      <div />
                    )}

                    {nextSection && (
                      <button
                        type="button"
                        onClick={() => handleSelectSection(nextSection.id)}
                        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-right transition-colors ml-auto"
                      >
                        <div>
                          <div className="text-[10px] font-mono text-cyan-300 uppercase">
                            Selanjutnya
                          </div>
                          <div className="text-xs font-semibold text-white">
                            {nextSection.number}. {nextSection.title}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-cyan-300 shrink-0" />
                      </button>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
