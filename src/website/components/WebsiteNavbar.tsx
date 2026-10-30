import React, { useState } from 'react';
import {
  Network,
  Menu,
  X,
  ArrowUpRight,
  BookOpen,
} from 'lucide-react';
import {
  APP_CONFIG,
  WebsiteSectionId,
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

interface WebsiteNavbarProps {
  activeSection: WebsiteSectionId;
  onSelectSection: (section: WebsiteSectionId, path: string) => void;
}

const NAV_ITEMS: Array<{ id: WebsiteSectionId; label: string; path: string }> = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'about', label: 'About', path: '/about' },
  { id: 'features', label: 'Features', path: '/features' },
  { id: 'use-cases', label: 'Use Cases', path: '/use-cases' },
  { id: 'preview', label: 'Product Preview', path: '/preview' },
  { id: 'docs', label: 'Documentation', path: '/docs' },
  { id: 'faq', label: 'FAQ', path: '/faq' },
  { id: 'contact', label: 'Contact', path: '/contact' },
];

export const WebsiteNavbar: React.FC<WebsiteNavbarProps> = ({
  activeSection,
  onSelectSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: { id: WebsiteSectionId; path: string }
  ) => {
    e.preventDefault();
    onSelectSection(item.id, item.path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 h-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="max-w-[1360px] mx-auto h-full px-6 md:px-10 flex items-center justify-between gap-6">
        {/* 1. Clean Brand Identity */}
        <a
          href="/"
          onClick={(e) => handleNavClick(e, { id: 'home', path: '/' })}
          className="flex items-center gap-2.5 text-white font-bold tracking-tight text-xl shrink-0"
        >
          <span className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Network className="w-5 h-5" />
          </span>
          <span>
            NET<span className="text-cyan-400">LAB</span>
          </span>
        </a>

        {/* 2. Primary Desktop Navigation */}
        <nav aria-label="Main Navigation" className="hidden xl:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.path}
                onClick={(e) => handleNavClick(e, item)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* 3. Primary Actions (Documentation shortcut & Launch NETLAB) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <a
            href="/docs"
            onClick={(e) =>
              handleNavClick(e, { id: 'docs', path: '/docs' })
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/70 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Docs</span>
          </a>

          <a
            href={getWorkspaceLaunchUrl()}
            onClick={handleLaunchWorkspace}
            title={`Open ${APP_CONFIG.applicationName} (${APP_CONFIG.applicationDomain})`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-sm"
          >
            <span>Launch NETLAB</span>
            <ArrowUpRight className="w-4 h-4 stroke-[2.25]" />
          </a>
        </div>

        {/* Mobile Menu Trigger */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation menu"
          className="xl:hidden p-2 rounded-lg border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-900"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-b border-slate-800 bg-slate-950/98 px-6 py-5 space-y-4">
          <nav className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  className={`px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-cyan-300 bg-cyan-500/10 border border-cyan-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs font-mono text-slate-400">
              Workspace Domain:{' '}
              <span className="text-cyan-400">{APP_CONFIG.applicationDomain}</span>
            </div>
            <a
              href={getWorkspaceLaunchUrl()}
              onClick={handleLaunchWorkspace}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
            >
              <span>Launch NETLAB Workspace</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
