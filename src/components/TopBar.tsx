import React, { useState } from 'react';
import { useNetworkStore } from '../store/useNetworkStore';
import {
  Network,
  RotateCcw,
  RotateCw,
  Save,
  Plus,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sun,
  Moon,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HelpCircle,
  Globe,
} from 'lucide-react';
import {
  APP_CONFIG,
  getOfficialWebsiteUrl,
  navigateToAppRoute,
} from '../config/appConfig';


export const TopBar: React.FC = () => {
  const {
    projects,
    activeProject,
    diagnostics,
    historyPast,
    historyFuture,
    isDarkTheme,
    switchProject,
    createNewProject,
    saveProjectToServer,
    importProjectJson,
    exportProjectJson,
    undo,
    redo,
    toggleTheme,
    validateCurrentTopology,
    setViewport,
    openUserGuide,
  } = useNetworkStore();

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [saveToast, setSaveToast] = useState(false);
  const [importToast, setImportToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = diagnostics.filter((d) => d.severity === 'warning').length;

  const handleSave = async () => {
    await saveProjectToServer();
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  const handleExport = () => {
    const jsonStr = exportProjectJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_netlab.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importProjectJson(content);
        if (success) {
          setImportToast({ ok: true, msg: 'Project imported!' });
        } else {
          setImportToast({ ok: false, msg: 'Invalid JSON' });
        }
        setTimeout(() => setImportToast(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createNewProject(newProjectName);
    setNewProjectName('');
    setIsNewProjectOpen(false);
  };

  const handleZoom = (delta: number) => {
    const vp = activeProject.viewport || { x: 0, y: 0, zoom: 1 };
    const nextZoom = Math.min(Math.max(vp.zoom + delta, 0.4), 2.0);
    setViewport({ ...vp, zoom: nextZoom });
  };

  const handleFitScreen = () => {
    setViewport({ x: 0, y: 0, zoom: 0.9 });
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between gap-4 z-40 select-none">
      {/* Zone 1: Brand & Project Selector */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2 text-cyan-400 font-bold tracking-tight text-lg">
          <Network className="w-5 h-5 text-cyan-400" />
          <span className="text-white">NET<span className="text-cyan-400">LAB</span></span>
        </div>

        <div className="h-4 w-[1px] bg-slate-700 mx-1 hidden sm:block" />

        {/* Project Selector */}
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-slate-400 hidden sm:block" />
          <select
            value={activeProject.id}
            onChange={(e) => switchProject(e.target.value)}
            className="bg-slate-800/90 text-xs font-medium text-slate-200 border border-slate-700 rounded px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 max-w-[200px] truncate"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsNewProjectOpen(true)}
            title="Create New Project"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Zone 2: Canvas Navigation, Undo/Redo & Topology Health */}
      <div className="flex items-center gap-3">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 bg-slate-800/80 rounded border border-slate-700/80 p-0.5">
          <button
            onClick={undo}
            disabled={historyPast.length === 0}
            title={`Undo (${historyPast.length})`}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={historyFuture.length === 0}
            title={`Redo (${historyFuture.length})`}
            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="hidden md:flex items-center gap-0.5 bg-slate-800/80 rounded border border-slate-700/80 p-0.5 text-xs text-slate-300">
          <button
            onClick={() => handleZoom(-0.15)}
            title="Zoom Out"
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 font-mono text-[11px] tabular-nums">
            {Math.round((activeProject.viewport?.zoom || 1) * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.15)}
            title="Zoom In"
            className="p-1 text-slate-400 hover:text-white rounded"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFitScreen}
            title="Fit to Screen"
            className="p-1 text-slate-400 hover:text-white rounded border-l border-slate-700 ml-0.5 pl-1.5"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Topology Diagnostic Status */}
        <button
          onClick={validateCurrentTopology}
          title="Click to run topology validation"
          className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 transition-colors text-xs"
        >
          {errorCount > 0 ? (
            <>
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="text-rose-400 font-semibold">{errorCount} {errorCount === 1 ? 'Error' : 'Errors'}</span>
            </>
          ) : warnCount > 0 ? (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-300 font-semibold">{warnCount} {warnCount === 1 ? 'Warning' : 'Warnings'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium">Topology Valid (RUN)</span>
            </>
          )}
        </button>
      </div>

      {/* Zone 3: User Guide, Save, Export/Import, Theme */}
      <div className="flex items-center gap-2 shrink-0">
        {importToast && (
          <span
            className={`text-[11px] font-semibold px-2 py-1 rounded border ${
              importToast.ok
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
            }`}
          >
            {importToast.msg}
          </span>
        )}

        <a
          href={getOfficialWebsiteUrl('/')}
          onClick={(e) => {
            const targetUrl = getOfficialWebsiteUrl('/');
            if (!/^https?:\/\//i.test(targetUrl)) {
              e.preventDefault();
              navigateToAppRoute(targetUrl);
            }
          }}
          title={`Buka ${APP_CONFIG.brandName} Official Website (${APP_CONFIG.mainDomain})`}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="hidden lg:inline">Website</span>
        </a>

        <button
          type="button"
          onClick={() => openUserGuide('getting-started')}
          title="Buka NETLAB User Guide & Application Help Center"
          aria-label="Open NETLAB User Guide"
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-cyan-950/80 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-xs"
        >
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>User Guide</span>
        </button>

        <button
          onClick={handleSave}
          title="Save project to persistent JSON store"
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{saveToast ? 'Saved!' : 'Save'}</span>
        </button>

        <button
          onClick={handleExport}
          title="Export topology as JSON"
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>

        <label
          title="Import topology JSON"
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>

        <button
          onClick={toggleTheme}
          title="Toggle Dark/Light theme"
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
        >
          {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Create New Project Modal */}
      {isNewProjectOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Create New Network Project</h3>
            <p className="text-xs text-slate-400 mb-4">
              Initialize a clean topology canvas with standard VLAN 1 and default routing tables.
            </p>
            <form onSubmit={handleCreateNew}>
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Kampus Barat — Core & Access"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
