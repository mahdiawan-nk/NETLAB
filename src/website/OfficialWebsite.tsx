import React, { useEffect, useState } from 'react';
import {
  WEBSITE_ROUTES,
  WebsiteSectionId,
} from '../config/appConfig';
import { WebsiteNavbar } from './components/WebsiteNavbar';
import { HeroSection } from './components/HeroSection';
import { AboutSection } from './components/AboutSection';
import { FeaturesSection } from './components/FeaturesSection';
import { UseCasesSection } from './components/UseCasesSection';
import { ProductPreviewSection } from './components/ProductPreviewSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { DocumentationSection } from './components/DocumentationSection';
import { FaqSection } from './components/FaqSection';
import { ContactSection } from './components/ContactSection';
import { WebsiteFooter } from './components/WebsiteFooter';

export const OfficialWebsite: React.FC = () => {
  const resolveInitialSection = (): WebsiteSectionId => {
    if (typeof window === 'undefined') return 'home';
    const path = window.location.pathname.toLowerCase();
    return WEBSITE_ROUTES[path] || 'home';
  };

  const [activeSection, setActiveSection] = useState<WebsiteSectionId>(
    resolveInitialSection
  );

  const scrollToSection = (sectionId: WebsiteSectionId) => {
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSelectSection = (section: WebsiteSectionId, path: string) => {
    setActiveSection(section);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    scrollToSection(section);
  };

  useEffect(() => {
    const initialSection = resolveInitialSection();
    if (initialSection !== 'home') {
      const timer = setTimeout(() => {
        scrollToSection(initialSection);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nextSection = resolveInitialSection();
      setActiveSection(nextSection);
      scrollToSection(nextSection);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* 1. Public Header / Navigation Bar */}
      <WebsiteNavbar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
      />

      {/* 2. Main Landing & Product Information Content */}
      <main>
        <HeroSection onSelectSection={handleSelectSection} />
        <AboutSection />
        <FeaturesSection />
        <UseCasesSection />
        <ProductPreviewSection />
        <HowItWorksSection />
        <DocumentationSection />
        <FaqSection />
        <ContactSection onSelectSection={handleSelectSection} />
      </main>

      {/* 3. Public Footer */}
      <WebsiteFooter onSelectSection={handleSelectSection} />
    </div>
  );
};
