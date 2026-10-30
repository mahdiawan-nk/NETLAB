import React from 'react';
import { Network, ArrowUpRight } from 'lucide-react';
import {
  APP_CONFIG,
  WebsiteSectionId,
  getWorkspaceLaunchUrl,
  navigateToAppRoute,
} from '../../config/appConfig';

interface WebsiteFooterProps {
  onSelectSection: (section: WebsiteSectionId, path: string) => void;
}

export const WebsiteFooter: React.FC<WebsiteFooterProps> = ({
  onSelectSection,
}) => {
  const currentYear = new Date().getFullYear();

  const handleLaunchWorkspace = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const targetUrl = getWorkspaceLaunchUrl();
    if (!/^https?:\/\//i.test(targetUrl)) {
      e.preventDefault();
      navigateToAppRoute(targetUrl);
    }
  };

  const handleSectionLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    section: WebsiteSectionId,
    path: string
  ) => {
    e.preventDefault();
    onSelectSection(section, path);
  };

  return (
    <footer className="bg-slate-950 text-slate-400 border-t border-slate-800/90">
      <div className="max-w-[1360px] mx-auto px-6 md:px-10 py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          {/* Column 1: Brand & Summary */}
          <div className="lg:col-span-5 space-y-4">
            <a
              href="/"
              onClick={(e) => handleSectionLink(e, 'home', '/')}
              className="inline-flex items-center gap-2.5 text-white font-bold tracking-tight text-xl"
            >
              <span className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Network className="w-4 h-4" />
              </span>
              <span>
                NET<span className="text-cyan-400">LAB</span>
              </span>
            </a>

            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              Platform Network Topology Designer dan Network Simulation untuk merancang,
              mengonfigurasi, menguji, serta memvalidasi arsitektur jaringan komputer dan
              perangkat MikroTik RouterOS secara virtual.
            </p>

            <div className="pt-1 space-y-1 text-xs font-mono text-slate-400">
              <div>
                Official Website:{' '}
                <span className="text-slate-200">{APP_CONFIG.mainDomain}</span>
              </div>
              <div>
                Workspace Domain:{' '}
                <span className="text-cyan-400">
                  {APP_CONFIG.applicationDomain}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Navigation */}
          <div className="lg:col-span-3 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-white font-bold">
              Navigasi Website
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/"
                  onClick={(e) => handleSectionLink(e, 'home', '/')}
                  className="hover:text-white transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={(e) => handleSectionLink(e, 'about', '/about')}
                  className="hover:text-white transition-colors"
                >
                  About NETLAB
                </a>
              </li>
              <li>
                <a
                  href="/features"
                  onClick={(e) => handleSectionLink(e, 'features', '/features')}
                  className="hover:text-white transition-colors"
                >
                  Core Features
                </a>
              </li>
              <li>
                <a
                  href="/use-cases"
                  onClick={(e) =>
                    handleSectionLink(e, 'use-cases', '/use-cases')
                  }
                  className="hover:text-white transition-colors"
                >
                  Use Cases
                </a>
              </li>
              <li>
                <a
                  href="/preview"
                  onClick={(e) => handleSectionLink(e, 'preview', '/preview')}
                  className="hover:text-white transition-colors"
                >
                  Product Preview
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Resources & Workspace */}
          <div className="lg:col-span-4 space-y-3">
            <div className="text-xs font-mono uppercase tracking-wider text-white font-bold">
              Dokumentasi &amp; Aplikasi
            </div>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/docs"
                  onClick={(e) => handleSectionLink(e, 'docs', '/docs')}
                  className="hover:text-white transition-colors"
                >
                  Documentation Overview
                </a>
              </li>
              <li>
                <a
                  href="/faq"
                  onClick={(e) => handleSectionLink(e, 'faq', '/faq')}
                  className="hover:text-white transition-colors"
                >
                  FAQ (Pertanyaan Umum)
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleSectionLink(e, 'contact', '/contact')}
                  className="hover:text-white transition-colors"
                >
                  Contact &amp; Project Info
                </a>
              </li>
              <li className="pt-2">
                <a
                  href={getWorkspaceLaunchUrl()}
                  onClick={handleLaunchWorkspace}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 text-xs font-semibold transition-colors"
                >
                  <span>Buka {APP_CONFIG.applicationName}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            &copy; {currentYear} {APP_CONFIG.brandName}. Network Topology Designer &amp;
            Simulation Platform.
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Environment: {APP_CONFIG.environment.toUpperCase()}
          </div>
        </div>
      </div>
    </footer>
  );
};
