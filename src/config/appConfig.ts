export interface AppConfig {
  brandName: string;
  mainDomain: string;
  applicationDomain: string;
  applicationName: string;
  environment: 'development' | 'staging' | 'production';
}

export const APP_CONFIG: AppConfig = {
  brandName: import.meta.env.VITE_BRAND_NAME || 'NETLAB',
  mainDomain: import.meta.env.VITE_MAIN_DOMAIN || 'https://netlab.com',
  applicationDomain: import.meta.env.VITE_APP_DOMAIN || 'https://lab.netlab.com',
  applicationName: import.meta.env.VITE_APP_NAME || 'NETLAB Workspace',
  environment:
    (import.meta.env.VITE_APP_ENV as AppConfig['environment']) || 'production',
};

export type WebsiteSectionId =
  | 'home'
  | 'about'
  | 'features'
  | 'use-cases'
  | 'preview'
  | 'how-it-works'
  | 'docs'
  | 'faq'
  | 'contact';

export const WEBSITE_ROUTES: Record<string, WebsiteSectionId> = {
  '/': 'home',
  '/about': 'about',
  '/features': 'features',
  '/use-cases': 'use-cases',
  '/preview': 'preview',
  '/how-it-works': 'how-it-works',
  '/docs': 'docs',
  '/documentation': 'docs',
  '/faq': 'faq',
  '/contact': 'contact',
};

/**
 * Extracts hostname safely from a configured domain URL string.
 */
export function extractHostname(domainUrl: string): string {
  try {
    return new URL(domainUrl).hostname.toLowerCase();
  } catch {
    return domainUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  }
}

/**
 * Checks whether the current browser hostname matches the configured Application Domain
 * (e.g. `lab.netlab.com` or any `lab.*` subdomain).
 */
export function isRunningOnApplicationDomain(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  const cleanHost = hostname.toLowerCase();
  const configuredAppHost = extractHostname(APP_CONFIG.applicationDomain);
  if (cleanHost === configuredAppHost) {
    return true;
  }
  if (cleanHost.startsWith('lab.')) {
    return true;
  }
  return false;
}

/**
 * Checks whether the current browser hostname matches the configured Main Website Domain
 * (e.g. `netlab.com` or `www.netlab.com`).
 */
export function isRunningOnMainDomain(
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''
): boolean {
  const cleanHost = hostname.toLowerCase();
  const configuredMainHost = extractHostname(APP_CONFIG.mainDomain);
  return (
    cleanHost === configuredMainHost ||
    cleanHost === `www.${configuredMainHost}`
  );
}

/**
 * Determines whether the current request/location should render the NETLAB Workspace
 * simulator or the NETLAB Official Website.
 *
 * Resolution rules:
 * 1. If accessed on the Application Domain (`lab.netlab.com`), always render Workspace
 *    unless explicitly requesting `/website`.
 * 2. If accessed on the Main Domain (`netlab.com`) or single-origin preview/local host,
 *    render Workspace when pathname starts with `/workspace` or `/lab` or query `?domain=lab`,
 *    and render Official Website for `/` and all public informational routes.
 */
export function shouldRenderWorkspace(
  locationObj: Location = window.location
): boolean {
  const pathname = locationObj.pathname.toLowerCase();
  const searchParams = new URLSearchParams(locationObj.search);
  const domainOverride = searchParams.get('domain')?.toLowerCase();

  if (domainOverride === 'main' || domainOverride === 'website') {
    return false;
  }
  if (domainOverride === 'lab' || domainOverride === 'workspace') {
    return true;
  }

  if (pathname === '/workspace' || pathname.startsWith('/workspace/') || pathname === '/lab' || pathname.startsWith('/lab/')) {
    return true;
  }

  if (pathname === '/website' || pathname.startsWith('/website/')) {
    return false;
  }

  if (isRunningOnApplicationDomain(locationObj.hostname)) {
    return true;
  }

  return false;
}

/**
 * Returns the target URL for launching the NETLAB Workspace.
 * - When running on the production Main Domain (`netlab.com`), returns `APP_CONFIG.applicationDomain` (`https://lab.netlab.com`).
 * - When running on a single-host preview or local dev environment, returns `/workspace` so navigation works seamlessly without DNS errors.
 */
export function getWorkspaceLaunchUrl(): string {
  if (typeof window !== 'undefined' && isRunningOnMainDomain(window.location.hostname)) {
    return APP_CONFIG.applicationDomain;
  }
  return '/workspace';
}

/**
 * Returns the target URL for navigating to the Official Website.
 * - When running on the production Application Domain (`lab.netlab.com`), returns `APP_CONFIG.mainDomain` (`https://netlab.com`).
 * - When running on a single-host preview or local dev environment, returns the local path (e.g. `/`, `/features`, `/docs`).
 */
export function getOfficialWebsiteUrl(path: string = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && isRunningOnApplicationDomain(window.location.hostname)) {
    const base = APP_CONFIG.mainDomain.replace(/\/$/, '');
    return normalizedPath === '/' ? base : `${base}${normalizedPath}`;
  }
  return normalizedPath;
}

/**
 * Navigates cleanly between Official Website routes and NETLAB Workspace
 * supporting both cross-domain redirects in production and History API SPA navigation in preview/local.
 */
export function navigateToAppRoute(targetUrl: string): void {
  if (typeof window === 'undefined') return;
  if (/^https?:\/\//i.test(targetUrl)) {
    window.location.href = targetUrl;
    return;
  }
  window.history.pushState({}, '', targetUrl);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
