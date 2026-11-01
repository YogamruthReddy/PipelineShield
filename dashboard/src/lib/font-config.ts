/**
 * PipelineShield Role-Based Typography System Specification
 *
 * Implements intentional visual hierarchy with dedicated font assignments:
 * - Page titles & major headings: Georgia (serif)
 * - Section headings & card titles: Inter (modern UI sans-serif)
 * - Body text, descriptions, labels & navigation: Inter / System sans-serif
 * - Buttons & form controls: Inherit body font
 * - Code blocks, commands, logs, JSON, diffs, hashes, CVEs, commit SHAs: Courier New / compatible monospace
 * - Tables: Body font for ordinary cells; Monospace for technical values
 * - Numbers & status metrics: Tabular numerals (tabular-nums)
 */

export type TypographyRoleId = "heading" | "subheading" | "body" | "mono" | "metric";

export interface TypographyRole {
  id: TypographyRoleId;
  name: string;
  fontFamily: string;
  targetElements: string;
  sampleText: string;
  description: string;
}

export const TYPOGRAPHY_ROLES: TypographyRole[] = [
  {
    id: "heading",
    name: "Page Titles & Major Headings",
    fontFamily: 'Georgia, Cambria, "Times New Roman", Times, serif',
    targetElements: "Page titles (ViewHeader h1), verdict banner headlines, hero titles",
    sampleText: "PipelineShield DevSecOps Gatekeeper",
    description: "Authoritative editorial serif for major headings and primary view titles",
  },
  {
    id: "subheading",
    name: "Section Headings & Card Titles",
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    targetElements: "Card titles, section headers, modal dialog titles, drawer section labels",
    sampleText: "Security Findings & Severity Breakdown",
    description: "Clean modern UI sans-serif for section dividers, cards, and modal titles",
  },
  {
    id: "body",
    name: "Body Text, Descriptions & Navigation",
    fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    targetElements: "Descriptions, summaries, form labels, navigation links, table text",
    sampleText: "Automated scan evaluation executed against branch main with zero policy bypasses.",
    description: "Highly legible geometric sans-serif for reading density and clarity",
  },
  {
    id: "mono",
    name: "Code, Diffs & Technical Identifiers",
    fontFamily: '"Courier New", Courier, var(--font-ibm-plex-mono), ui-monospace, monospace',
    targetElements: "CVE IDs, commit SHAs, file paths, diff hunks, shell commands, JSON",
    sampleText: "CVE-2022-42966 / commit: 8f2a1b9c / pip install qs==6.11.0",
    description: "High-contrast monospace for unambiguous technical identifier inspection",
  },
  {
    id: "metric",
    name: "Numbers & Status Metrics",
    fontFamily: 'var(--font-inter), sans-serif (tabular-nums)',
    targetElements: "KPI counts, blocker metrics, line numbers, exit codes, delta values (+/-)",
    sampleText: "4 Blocking | 14 Warnings | 99.8% Pass Rate",
    description: "Monospaced numerals ensuring column alignment and rapid metric scanning",
  },
];

// Compatibility definitions for existing test suite assertions
export type FontCategory = "modern-ui" | "serif" | "sans-serif" | "monospace";

export interface FontOption {
  id: string;
  name: string;
  category: FontCategory;
  categoryLabel: string;
  family: string;
  sampleText: string;
  desc: string;
}

export const DEFAULT_FONT_ID = "inter";
export const STORAGE_KEY = "pipelineshield_ui_font_theme";

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "inter",
    name: "Inter (Modern UI)",
    category: "modern-ui",
    categoryLabel: "Modern UI",
    family: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sampleText: "DevSecOps telemetry and automated gatekeeper policy",
    desc: "Default geometric clean sans-serif optimized for enterprise screens",
  },
  {
    id: "georgia",
    name: "Georgia",
    category: "serif",
    categoryLabel: "Serif",
    family: 'Georgia, Cambria, "Times New Roman", Times, serif',
    sampleText: "Security audit findings and compliance governance records",
    desc: "Warm editorial serif with high legibility across low and high DPI screens",
  },
  {
    id: "times-new-roman",
    name: "Times New Roman",
    category: "serif",
    categoryLabel: "Serif",
    family: '"Times New Roman", Times, Georgia, serif',
    sampleText: "Formal policy declarations and regulatory audit reports",
    desc: "Classic authoritative print serif for formal audit and policy review",
  },
  {
    id: "palatino",
    name: "Palatino Linotype",
    category: "serif",
    categoryLabel: "Serif",
    family: '"Palatino Linotype", Palatino, "URW Palladio L", "Book Antiqua", Georgia, serif',
    sampleText: "Executive risk review and security posture overview",
    desc: "Renaissance proportions with graceful calligraphic authority",
  },
  {
    id: "arial",
    name: "Arial",
    category: "sans-serif",
    categoryLabel: "Sans-Serif",
    family: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
    sampleText: "Universal clean readability across every browser",
    desc: "Universal standard neutral sans-serif with crisp baseline metrics",
  },
  {
    id: "verdana",
    name: "Verdana",
    category: "sans-serif",
    categoryLabel: "Sans-Serif",
    family: 'Verdana, Geneva, Tahoma, sans-serif',
    sampleText: "Generous letter spacing and open apertures",
    desc: "Wide proportions designed specifically for pixel-perfect small-text reading",
  },
  {
    id: "tahoma",
    name: "Tahoma",
    category: "sans-serif",
    categoryLabel: "Sans-Serif",
    family: 'Tahoma, Verdana, "Segoe UI", sans-serif',
    sampleText: "Compact text density for dense security tables",
    desc: "Tight letter spacing tailored for high-density tabular secops consoles",
  },
  {
    id: "trebuchet",
    name: "Trebuchet MS",
    category: "sans-serif",
    categoryLabel: "Sans-Serif",
    family: '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif',
    sampleText: "Dynamic humanist sans-serif with distinct personality",
    desc: "Humanist sans-serif with high distinguishability between characters",
  },
  {
    id: "courier-new",
    name: "Courier New",
    category: "monospace",
    categoryLabel: "Monospace",
    family: '"Courier New", Courier, monospace',
    sampleText: "SHA256: 8f2a1b9c3e4d5f6a / CVE-2022-42966",
    desc: "Classic typewriter monospace with wide clear character boundaries",
  },
  {
    id: "consolas",
    name: "Consolas",
    category: "monospace",
    categoryLabel: "Monospace",
    family: 'Consolas, "Lucida Console", "Liberation Mono", monospace',
    sampleText: "def evaluate_gate(policy, report): return BLOCK",
    desc: "Clear programming font with distinct zero and operator glyphs",
  },
  {
    id: "lucida-console",
    name: "Lucida Console",
    category: "monospace",
    categoryLabel: "Monospace",
    family: '"Lucida Console", Monaco, monospace',
    sampleText: "exit code 1: 3 blocking vulnerabilities found",
    desc: "Balanced clean monospace suited for logs and diagnostic traces",
  },
];
