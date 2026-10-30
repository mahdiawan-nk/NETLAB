export type GuideSectionId =
  | 'getting-started'
  | 'application-overview'
  | 'workspace-navigation'
  | 'topology-editor'
  | 'device-management'
  | 'interface-connections'
  | 'isp-management'
  | 'bandwidth-cir'
  | 'workload-management'
  | 'network-simulation'
  | 'monitoring'
  | 'diagnostics'
  | 'event-audit-log'
  | 'mikrotik-console'
  | 'cli-reference'
  | 'configuration-management'
  | 'import-export'
  | 'troubleshooting'
  | 'faq';

export type GuideCategoryName =
  | 'Dasar & Workspace'
  | 'Topologi & Perangkat'
  | 'WAN, Beban & Simulasi'
  | 'MikroTik & Konfigurasi'
  | 'Troubleshooting & FAQ';

export interface GuideFeatureItem {
  name: string;
  status: 'active' | 'simulated';
  description: string;
}

export interface GuideStepItem {
  stepNumber: number;
  title: string;
  description: string;
  tip?: string;
}

export interface GuideProblemSummary {
  problem: string;
  cause: string;
  solution: string;
}

export interface GuideTechnicalTable {
  title: string;
  description?: string;
  headers: string[];
  rows: string[][];
}

export interface GuideCodeExample {
  title: string;
  description?: string;
  language: 'routeros' | 'netlab-cli' | 'text';
  code: string;
}

export interface GuideCliCommandReference {
  context: string;
  command: string;
  syntax: string;
  description: string;
}

export interface GuideTroubleshootingCard {
  id: string;
  number: number;
  title: string;
  symptom: string;
  probableCause: string;
  inspectionMethod: string;
  remediationSteps: string[];
  expectedOutcome: string;
}

export interface GuideFaqItem {
  question: string;
  answer: string;
  category: string;
}

export interface GuideSectionContent {
  id: GuideSectionId;
  number: string;
  title: string;
  subtitle: string;
  category: GuideCategoryName;
  iconName: string;
  description: string;
  purpose: string;
  simulationNotice?: string;
  availableFeatures: GuideFeatureItem[];
  steps: GuideStepItem[];
  technicalTables?: GuideTechnicalTable[];
  cliCommands?: GuideCliCommandReference[];
  codeExamples?: GuideCodeExample[];
  troubleshootingCards?: GuideTroubleshootingCard[];
  faqItems?: GuideFaqItem[];
  expectedResults: string[];
  tips: string[];
  commonProblems: GuideProblemSummary[];
  relatedGuides: GuideSectionId[];
}

export interface GuideSearchResult {
  sectionId: GuideSectionId;
  sectionTitle: string;
  category: GuideCategoryName;
  matchType: string;
  snippet: string;
}
