import { GuideSectionContent, GuideSectionId, GuideSearchResult } from '../types/userGuide';
import { PART1_CORE_GUIDES } from './guideSections/part1CoreGuides';
import { PART2_SIMULATION_GUIDES } from './guideSections/part2SimulationGuides';
import { PART3_CONSOLE_AND_SUPPORT_GUIDES } from './guideSections/part3ConsoleAndSupportGuides';

export const USER_GUIDE_SECTIONS: GuideSectionContent[] = [
  ...PART1_CORE_GUIDES,
  ...PART2_SIMULATION_GUIDES,
  ...PART3_CONSOLE_AND_SUPPORT_GUIDES,
];

export const USER_GUIDE_MAP: Record<GuideSectionId, GuideSectionContent> = USER_GUIDE_SECTIONS.reduce(
  (acc, section) => {
    acc[section.id] = section;
    return acc;
  },
  {} as Record<GuideSectionId, GuideSectionContent>
);

export const GUIDE_CATEGORIES: Array<{
  name: GuideSectionContent['category'];
  sections: GuideSectionContent[];
}> = [
  {
    name: 'Dasar & Workspace',
    sections: USER_GUIDE_SECTIONS.filter((s) => s.category === 'Dasar & Workspace'),
  },
  {
    name: 'Topologi & Perangkat',
    sections: USER_GUIDE_SECTIONS.filter((s) => s.category === 'Topologi & Perangkat'),
  },
  {
    name: 'WAN, Beban & Simulasi',
    sections: USER_GUIDE_SECTIONS.filter((s) => s.category === 'WAN, Beban & Simulasi'),
  },
  {
    name: 'MikroTik & Konfigurasi',
    sections: USER_GUIDE_SECTIONS.filter((s) => s.category === 'MikroTik & Konfigurasi'),
  },
  {
    name: 'Troubleshooting & FAQ',
    sections: USER_GUIDE_SECTIONS.filter((s) => s.category === 'Troubleshooting & FAQ'),
  },
];

export function searchUserGuide(rawQuery: string): GuideSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const results: GuideSearchResult[] = [];

  for (const section of USER_GUIDE_SECTIONS) {
    // 1. Check Title & Subtitle
    if (
      section.title.toLowerCase().includes(query) ||
      section.subtitle.toLowerCase().includes(query) ||
      section.description.toLowerCase().includes(query)
    ) {
      results.push({
        sectionId: section.id,
        sectionTitle: `${section.number}. ${section.title}`,
        category: section.category,
        matchType: 'Judul & Ringkasan Modul',
        snippet: section.subtitle,
      });
    }

    // 2. Check Available Features
    for (const feat of section.availableFeatures) {
      if (
        feat.name.toLowerCase().includes(query) ||
        feat.description.toLowerCase().includes(query)
      ) {
        results.push({
          sectionId: section.id,
          sectionTitle: `${section.number}. ${section.title}`,
          category: section.category,
          matchType: `Fitur: ${feat.name}`,
          snippet: feat.description,
        });
      }
    }

    // 3. Check Step-by-Step Instructions
    for (const step of section.steps) {
      if (
        step.title.toLowerCase().includes(query) ||
        step.description.toLowerCase().includes(query)
      ) {
        results.push({
          sectionId: section.id,
          sectionTitle: `${section.number}. ${section.title}`,
          category: section.category,
          matchType: `Langkah ${step.stepNumber}: ${step.title}`,
          snippet: step.description,
        });
      }
    }

    // 4. Check CLI Commands
    if (section.cliCommands) {
      for (const cmd of section.cliCommands) {
        if (
          cmd.command.toLowerCase().includes(query) ||
          cmd.syntax.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query)
        ) {
          results.push({
            sectionId: section.id,
            sectionTitle: `${section.number}. ${section.title}`,
            category: section.category,
            matchType: `CLI: ${cmd.command}`,
            snippet: `${cmd.description} (${cmd.syntax.split('\n')[0]})`,
          });
        }
      }
    }

    // 5. Check Troubleshooting Cards
    if (section.troubleshootingCards) {
      for (const card of section.troubleshootingCards) {
        if (
          card.title.toLowerCase().includes(query) ||
          card.symptom.toLowerCase().includes(query) ||
          card.probableCause.toLowerCase().includes(query)
        ) {
          results.push({
            sectionId: section.id,
            sectionTitle: `${section.number}. ${section.title}`,
            category: section.category,
            matchType: `Troubleshooting #${card.number}: ${card.title}`,
            snippet: `Gejala: ${card.symptom}`,
          });
        }
      }
    }

    // 6. Check Common Problems
    for (const prob of section.commonProblems) {
      if (
        prob.problem.toLowerCase().includes(query) ||
        prob.cause.toLowerCase().includes(query) ||
        prob.solution.toLowerCase().includes(query)
      ) {
        results.push({
          sectionId: section.id,
          sectionTitle: `${section.number}. ${section.title}`,
          category: section.category,
          matchType: `Masalah Umum: ${prob.problem}`,
          snippet: `Solusi: ${prob.solution}`,
        });
      }
    }

    // 7. Check FAQ Items
    if (section.faqItems) {
      for (const faq of section.faqItems) {
        if (
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query)
        ) {
          results.push({
            sectionId: section.id,
            sectionTitle: `${section.number}. ${section.title}`,
            category: section.category,
            matchType: `FAQ: ${faq.question}`,
            snippet: faq.answer,
          });
        }
      }
    }
  }

  return results.slice(0, 35);
}
