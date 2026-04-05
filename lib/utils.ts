export function timeAgo(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function formatSalary(min: number | null, max: number | null): string {
  const fmt = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return "Salary not listed";
}

export function applicantColor(count: number): string {
  if (count < 25) return "text-green-600";
  if (count <= 100) return "text-yellow-600";
  return "text-red-600";
}

export function daysSince(dateString: string | null): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Seniority scoring ----------

const ENTRY_LEVEL_TITLE_SIGNALS = [
  "entry level", "entry-level", "junior", "associate", "intern", "internship",
  "new grad", "graduate", "coordinator", "assistant", "analyst",
  "specialist", "development representative",
];

const ENTRY_LEVEL_TITLE_ABBREVS = /\b(bdr|sdr)\b/i;

const ENTRY_LEVEL_EXP_PATTERNS = [
  /\b0[-–]2\s*years/i, /\b1[-–]2\s*years/i, /\b0[-–]3\s*years/i,
  /\b1[-–]3\s*years/i, /\b2[-–]4\s*years/i,
];

const SENIOR_EXP_PATTERNS = [
  { pattern: /\b(?:10|12|15)\+?\s*years/i, boost: 2 },
  { pattern: /\b[7-9]\+?\s*years/i, boost: 1 },
  { pattern: /\b[5-6]\+?\s*years/i, boost: 0 },
];

export function computeSeniorityScore(title: string | null, description: string | null): number {
  const t = (title ?? "").toLowerCase();
  const d = (description ?? "").toLowerCase();

  // Check for entry-level signals in title
  for (const signal of ENTRY_LEVEL_TITLE_SIGNALS) {
    if (t.includes(signal)) return 0;
  }
  if (ENTRY_LEVEL_TITLE_ABBREVS.test(t)) return 0;

  // Check for entry-level experience requirements in description
  for (const pat of ENTRY_LEVEL_EXP_PATTERNS) {
    if (pat.test(d)) return 0;
  }

  // Score by title
  let score = 0;

  // 5 = C-suite, SVP, Head of
  if (/\b(chief|cro|coo|cfo|ceo|cmo|cto|svp|senior vice president)\b/i.test(t) ||
      /\bhead of\b/i.test(t)) {
    score = 5;
  }
  // 4 = VP, Vice President
  else if (/\b(vp|vice president)\b/i.test(t)) {
    score = 4;
  }
  // 3 = Director, Senior Director
  else if (/\bdirector\b/i.test(t)) {
    score = 3;
  }
  // 2 = Senior, Lead, Manager
  else if (/\b(senior|lead|manager)\b/i.test(t)) {
    score = 2;
  }
  // 1 = Enterprise/Strategic IC roles (inherently senior)
  else if (/\b(enterprise|strategic)\b/i.test(t)) {
    score = 1;
  }
  // 1 = Other IC with 5+ years experience signal in description
  else {
    let hasExpSignal = false;
    for (const { pattern } of SENIOR_EXP_PATTERNS) {
      if (pattern.test(d)) { hasExpSignal = true; break; }
    }
    score = hasExpSignal ? 1 : 0;
  }

  // Boost from experience requirements (cap at 5)
  if (score > 0 && score < 5) {
    for (const { pattern, boost } of SENIOR_EXP_PATTERNS) {
      if (pattern.test(d)) {
        score = Math.min(5, score + boost);
        break;
      }
    }
  }

  return score;
}

// ---------- Company intelligence ----------

import { WatchlistCompany } from "./types";

const RECOGNIZABLE_INVESTORS = [
  "a16z", "andreessen", "sequoia", "greylock", "accel", "benchmark",
  "lightspeed", "kkr", "thoma bravo", "vista equity", "general atlantic",
  "tiger global", "coatue", "insight partners", "bessemer", "index ventures",
  "founders fund", "kleiner perkins", "gv", "google ventures", "softbank",
  "ivp", "ribbit", "menlo", "NEA", "battery ventures",
];

export function computeCompanyFitScore(co: WatchlistCompany): number {
  let score = 0;

  // PE exposure: Core=30, Significant=20, Emerging=10
  const pe = co.pe_revenue_exposure ?? "";
  if (pe.startsWith("Core")) score += 30;
  else if (pe.startsWith("Significant")) score += 20;
  else if (pe.startsWith("Emerging")) score += 10;

  // Employee growth >15%=15, >5%=10
  const growth = co.employee_growth_6m ?? 0;
  if (growth > 15) score += 15;
  else if (growth > 5) score += 10;

  // Glassdoor >4.0=10, >3.5=5
  const gd = co.glassdoor_rating ?? 0;
  if (gd > 4.0) score += 10;
  else if (gd > 3.5) score += 5;

  // Revenue stage $10M+=10
  const rev = co.revenue_stage ?? "";
  if (rev.includes("$10-50M") || rev.includes("$50-100M") || rev.includes("$100M+")) {
    score += 10;
  }

  // Recent funding within last 12 months=15
  if (co.last_funding_date) {
    const fundingDate = new Date(co.last_funding_date);
    const monthsAgo = (Date.now() - fundingDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo <= 12) score += 15;
  }

  // Has CRO/sales leader=10
  if (co.cro_name?.trim()) score += 10;

  // Has recognizable investors=10
  if (co.key_investors) {
    const investorsLower = co.key_investors.toLowerCase();
    if (RECOGNIZABLE_INVESTORS.some((inv) => investorsLower.includes(inv.toLowerCase()))) {
      score += 10;
    }
  }

  return Math.min(100, score);
}

export function fundingStageBadge(stage: string | null): { label: string; color: string } | null {
  if (!stage) return null;
  if (stage === "Seed" || stage === "Series A")
    return { label: stage, color: "bg-emerald-100 text-emerald-800" };
  if (stage === "Series B" || stage === "Series C")
    return { label: stage, color: "bg-sky-100 text-sky-800" };
  if (stage === "Series D+" || stage === "PE-backed")
    return { label: stage, color: "bg-violet-100 text-violet-800" };
  if (stage === "Public")
    return { label: stage, color: "bg-claude-hover text-claude-secondary" };
  return { label: stage, color: "bg-claude-hover text-claude-secondary" };
}

export function growthIndicator(growth: number | null): { icon: string; color: string } {
  if (growth == null) return { icon: "", color: "" };
  if (growth > 10) return { icon: "\u2191", color: "text-emerald-600" };
  if (growth >= 0) return { icon: "\u2192", color: "text-amber-500" };
  return { icon: "\u2193", color: "text-red-500" };
}

export function seniorityBadge(score: number | null): { label: string; color: string } | null {
  switch (score) {
    case 5: return { label: "C-Suite/Head", color: "bg-violet-100 text-violet-800" };
    case 4: return { label: "VP", color: "bg-indigo-100 text-indigo-800" };
    case 3: return { label: "Director", color: "bg-sky-100 text-sky-800" };
    case 2: return { label: "Senior", color: "bg-emerald-100 text-emerald-800" };
    case 1: return { label: "Mid-Level", color: "bg-claude-hover text-claude-secondary" };
    default: return null;
  }
}
