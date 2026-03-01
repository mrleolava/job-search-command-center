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

export function seniorityBadge(score: number | null): { label: string; color: string } | null {
  switch (score) {
    case 5: return { label: "C-Suite/Head", color: "bg-purple-100 text-purple-800" };
    case 4: return { label: "VP", color: "bg-indigo-100 text-indigo-800" };
    case 3: return { label: "Director", color: "bg-blue-100 text-blue-800" };
    case 2: return { label: "Senior", color: "bg-teal-100 text-teal-800" };
    case 1: return { label: "Mid-Level", color: "bg-gray-100 text-gray-700" };
    default: return null;
  }
}
