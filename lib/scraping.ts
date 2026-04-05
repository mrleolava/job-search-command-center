export interface RawJob {
  company: string;
  title: string;
  url: string;
  location: string | null;
  date_posted: string | null;
  source: string;
  is_remote: boolean;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
}

// ---------- Salary parsing ----------

interface SalaryRange {
  min: number | null;
  max: number | null;
}

const HOURLY_TO_ANNUAL = 2080;

/** Parse a dollar amount string into a number. Handles $120k, $120K, $120,000, $120,000.00, 120000 */
function parseDollarAmount(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, "");
  // "120k" or "120K"
  const kMatch = s.match(/^(\d+(?:\.\d+)?)[kK]$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  // "120000" or "120000.00"
  const numMatch = s.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return Math.round(parseFloat(numMatch[1]));
  return null;
}

/** Normalize a parsed salary to annual. Returns null if value seems invalid. */
function toAnnual(value: number, isHourly: boolean): number | null {
  if (isHourly) {
    const annual = value * HOURLY_TO_ANNUAL;
    return annual >= 20000 ? annual : null;
  }
  // If raw number is small (< 500), treat as hourly even without explicit marker
  if (value > 0 && value < 500) {
    const annual = value * HOURLY_TO_ANNUAL;
    return annual >= 20000 ? annual : null;
  }
  // Must be at least $20k to be a valid annual salary
  return value >= 20000 ? value : null;
}

/** Extract all salary ranges from text. Returns array of {min, max} sorted by max desc. */
function extractAllRanges(text: string): SalaryRange[] {
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");

  const ranges: SalaryRange[] = [];
  const seen = new Set<string>();

  function addRange(min: number | null, max: number | null) {
    const key = `${min}-${max}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (min || max) ranges.push({ min, max });
  }

  // Check for hourly context
  const hourlyContext = /per\s+hour|\/\s*h(?:ou)?r|\bhourlly?\b/i;
  const isHourlyDoc = hourlyContext.test(clean);

  // ---------- RANGE PATTERNS (two values) ----------

  // Pattern 1: "$120,000 - $160,000" / "$120K - $160K" / "$120k-$160k" / "$120,000.00 - $160,000.00"
  // Also: "USD $120,000 - $200,000" / "$120,000 to $160,000" / "$120,000 and $200,000"
  const rangeWithDollar = /\$\s*([\d,.]+[kK]?)\s*(?:[-–—]+|to|and)\s*\$\s*([\d,.]+[kK]?)/g;
  let m;
  while ((m = rangeWithDollar.exec(clean)) !== null) {
    const nearText = clean.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30);
    const isHourly = isHourlyDoc || hourlyContext.test(nearText);
    const v1 = parseDollarAmount(m[1]);
    const v2 = parseDollarAmount(m[2]);
    if (v1 !== null && v2 !== null) {
      const a1 = toAnnual(v1, isHourly);
      const a2 = toAnnual(v2, isHourly);
      if (a1 || a2) addRange(a1, a2);
    }
  }

  // Pattern 2: "$120-160k" / "$120 - $160k" / "120-160K" / "Compensation: 150-200k"
  const rangeShortK = /\$?\s*(\d+)\s*[-–—]+\s*\$?\s*(\d+)\s*[kK]/g;
  while ((m = rangeShortK.exec(clean)) !== null) {
    const v1 = +m[1], v2 = +m[2];
    if (v1 > 0 && v1 < 1000 && v2 > 0 && v2 < 1000) {
      addRange(v1 * 1000, v2 * 1000);
    }
  }

  // Pattern 3: "Pay Range: 150000-200000" / "120,000 - 160,000 USD"
  const rangeNoDollar = /(?:pay|salary|compensation|range|between)\s*:?\s*([\d,]+)\s*[-–—]+\s*([\d,]+)/gi;
  while ((m = rangeNoDollar.exec(clean)) !== null) {
    const v1 = parseInt(m[1].replace(/,/g, ""), 10);
    const v2 = parseInt(m[2].replace(/,/g, ""), 10);
    if (v1 >= 20000 && v2 >= 20000) addRange(v1, v2);
  }

  // Pattern 4: "between $150,000 and $200,000"
  const betweenPattern = /between\s+\$\s*([\d,.]+[kK]?)\s+and\s+\$\s*([\d,.]+[kK]?)/gi;
  while ((m = betweenPattern.exec(clean)) !== null) {
    const v1 = parseDollarAmount(m[1]);
    const v2 = parseDollarAmount(m[2]);
    if (v1 !== null && v2 !== null) {
      const a1 = toAnnual(v1, false);
      const a2 = toAnnual(v2, false);
      if (a1 || a2) addRange(a1, a2);
    }
  }

  // Pattern 5: "$70 - $90 per hour" (explicit hourly range)
  const hourlyRange = /\$\s*([\d,.]+)\s*[-–—]+\s*\$\s*([\d,.]+)\s*(?:per\s+hour|\/\s*h(?:ou)?r)/gi;
  while ((m = hourlyRange.exec(clean)) !== null) {
    const v1 = parseFloat(m[1].replace(/,/g, ""));
    const v2 = parseFloat(m[2].replace(/,/g, ""));
    if (v1 > 0 && v2 > 0) {
      addRange(Math.round(v1 * HOURLY_TO_ANNUAL), Math.round(v2 * HOURLY_TO_ANNUAL));
    }
  }

  // Pattern 6: "120,000 - 160,000 USD" (no dollar sign, USD suffix)
  const usdSuffix = /([\d,]+)\s*[-–—]+\s*([\d,]+)\s*USD/gi;
  while ((m = usdSuffix.exec(clean)) !== null) {
    const v1 = parseInt(m[1].replace(/,/g, ""), 10);
    const v2 = parseInt(m[2].replace(/,/g, ""), 10);
    if (v1 >= 20000 && v2 >= 20000) addRange(v1, v2);
  }

  // Pattern 7: "USD $150,000 - $200,000"
  const usdPrefix = /USD\s+\$\s*([\d,.]+[kK]?)\s*[-–—]+\s*\$\s*([\d,.]+[kK]?)/gi;
  while ((m = usdPrefix.exec(clean)) !== null) {
    const v1 = parseDollarAmount(m[1]);
    const v2 = parseDollarAmount(m[2]);
    if (v1 !== null && v2 !== null) {
      const a1 = toAnnual(v1, false);
      const a2 = toAnnual(v2, false);
      if (a1 || a2) addRange(a1, a2);
    }
  }

  // ---------- SINGLE VALUE PATTERNS ----------

  // Pattern 8: "$150k+" / "$150,000+"
  const plusPattern = /\$\s*([\d,.]+[kK]?)\s*\+/g;
  while ((m = plusPattern.exec(clean)) !== null) {
    const v = parseDollarAmount(m[1]);
    if (v !== null && v >= 20000) addRange(v, null);
  }

  // Pattern 9: "$150,000 base" / "$150K base" / "$150,000/yr" / "$150,000 annually" / "$150,000 per year"
  const singleAnnual = /\$\s*([\d,.]+[kK]?)\s*(?:\/\s*(?:year|yr|annually)|per\s+(?:year|annum)|base|annually|annual)/gi;
  while ((m = singleAnnual.exec(clean)) !== null) {
    const v = parseDollarAmount(m[1]);
    if (v !== null && v >= 20000) addRange(v, null);
  }

  // Pattern 10: "$X per hour" single value
  const singleHourly = /\$\s*([\d,.]+)\s*(?:per\s+hour|\/\s*h(?:ou)?r)/gi;
  while ((m = singleHourly.exec(clean)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (v > 0 && v < 500) addRange(Math.round(v * HOURLY_TO_ANNUAL), null);
  }

  // Pattern 11: Standalone "$120k" or "$120K" near salary context words
  if (ranges.length === 0) {
    const ctxPattern = /(?:salary|compensation|pay\s|earning|ote|base|total\s+comp|annual|range|offer)/i;
    if (ctxPattern.test(clean)) {
      const standalone = /\$\s*(\d+)\s*[kK]/g;
      while ((m = standalone.exec(clean)) !== null) {
        const v = +m[1] * 1000;
        if (v >= 20000) addRange(v, null);
      }
    }
  }

  // Pattern 12: Standalone "$120,000" near salary context (fallback)
  if (ranges.length === 0) {
    const ctxPattern = /(?:salary|compensation|pay\s|earning|ote|base|total\s+comp|annual|range|offer)/i;
    if (ctxPattern.test(clean)) {
      const standaloneNum = /\$\s*([\d,]+(?:\.\d{2})?)\b/g;
      while ((m = standaloneNum.exec(clean)) !== null) {
        const v = parseInt(m[1].replace(/,/g, ""), 10);
        if (v >= 20000) addRange(v, null);
      }
    }
  }

  return ranges;
}

/**
 * Parse salary from text. Searches the entire text for all salary ranges.
 * When multiple ranges are found, prefers OTE/total comp over base, takes the highest.
 */
export function parseSalary(text: string | null): SalaryRange {
  if (!text) return { min: null, max: null };

  const ranges = extractAllRanges(text);
  if (ranges.length === 0) return { min: null, max: null };
  if (ranges.length === 1) return ranges[0];

  // Prefer the range with the highest max (likely OTE/total comp)
  const best = ranges.reduce((a, b) => {
    const aMax = a.max ?? a.min ?? 0;
    const bMax = b.max ?? b.min ?? 0;
    return bMax > aMax ? b : a;
  });

  return best;
}

// ---------- API fetchers ----------

export async function fetchGreenhouseJobs(
  companyName: string,
  slug: string
): Promise<RawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true&pay_transparency=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs ?? []).map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (j: any) => {
      const content = j.content ?? "";

      // Prefer structured pay_input_ranges (values in cents)
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      const payRanges: unknown[] = j.pay_input_ranges ?? [];
      if (payRanges.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usdRange = payRanges.find((r: any) => r.currency_type === "USD") ?? payRanges[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = usdRange as any;
        if (r.min_cents) salaryMin = Math.round(r.min_cents / 100);
        if (r.max_cents) salaryMax = Math.round(r.max_cents / 100);
      }

      // Fall back to parsing description
      if (!salaryMin && !salaryMax) {
        const salary = parseSalary(content);
        salaryMin = salary.min;
        salaryMax = salary.max;
      }

      return {
        company: companyName,
        title: j.title ?? "",
        url: j.absolute_url ?? `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
        location: j.location?.name ?? null,
        date_posted: j.updated_at ?? j.first_published_at ?? null,
        source: "greenhouse",
        is_remote: (j.location?.name ?? "").toLowerCase().includes("remote") || false,
        salary_min: salaryMin,
        salary_max: salaryMax,
        description: content || null,
      };
    });
  } catch {
    console.error(`[greenhouse] Error fetching ${slug}`);
    return [];
  }
}

export async function fetchAshbyJobs(
  companyName: string,
  slug: string
): Promise<RawJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.jobs ?? []).map((j: any) => {
      const desc = j.descriptionPlain ?? "";
      const descHtml = j.descriptionHtml ?? "";

      // Prefer structured compensation data
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      const comp = j.compensation;
      if (comp?.summaryComponents) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const salaryComp = comp.summaryComponents.find((c: any) => c.compensationType === "Salary");
        if (salaryComp) {
          if (salaryComp.minValue) salaryMin = salaryComp.minValue;
          if (salaryComp.maxValue) salaryMax = salaryComp.maxValue;
          // Convert hourly to annual
          if (salaryComp.interval === "1 HOUR") {
            if (salaryMin) salaryMin = salaryMin * HOURLY_TO_ANNUAL;
            if (salaryMax) salaryMax = salaryMax * HOURLY_TO_ANNUAL;
          }
        }
      }

      // Fall back to parsing description
      if (!salaryMin && !salaryMax) {
        const salary = parseSalary(desc || descHtml);
        salaryMin = salary.min;
        salaryMax = salary.max;
      }

      return {
        company: companyName,
        title: j.title ?? "",
        url: j.jobUrl ?? `https://jobs.ashbyhq.com/${slug}/${j.id}`,
        location: j.location ?? null,
        date_posted: j.publishedAt ?? null,
        source: "ashby",
        is_remote:
          (j.location ?? "").toLowerCase().includes("remote") ||
          j.isRemote === true,
        salary_min: salaryMin,
        salary_max: salaryMax,
        description: desc || null,
      };
    });
  } catch {
    console.error(`[ashby] Error fetching ${slug}`);
    return [];
  }
}

export async function fetchLeverJobs(
  companyName: string,
  slug: string
): Promise<RawJob[]> {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((j: any) => {
      const desc = j.descriptionPlain ?? j.description ?? "";
      const additional = j.additionalPlain ?? j.additional ?? "";
      const fullText = desc + " " + additional;
      const location = j.categories?.location ?? null;

      // Prefer structured salaryRange
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      if (j.salaryRange) {
        if (j.salaryRange.min) salaryMin = j.salaryRange.min;
        if (j.salaryRange.max) salaryMax = j.salaryRange.max;
      }

      // Fall back to parsing description
      if (!salaryMin && !salaryMax) {
        const salary = parseSalary(fullText);
        salaryMin = salary.min;
        salaryMax = salary.max;
      }

      return {
        company: companyName,
        title: j.text ?? "",
        url: j.hostedUrl ?? `https://jobs.lever.co/${slug}/${j.id}`,
        location,
        date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        source: "lever",
        is_remote: (location ?? "").toLowerCase().includes("remote"),
        salary_min: salaryMin,
        salary_max: salaryMax,
        description: desc || null,
      };
    });
  } catch {
    console.error(`[lever] Error fetching ${slug}`);
    return [];
  }
}

// ---------- Curated board keyword search (no API keys needed) ----------

import { CURATED_BOARDS, CuratedBoard } from "./curated-boards";

/**
 * Scrape curated Greenhouse/Lever/Ashby boards and return all jobs.
 * Fetches boards in parallel batches to avoid overwhelming the APIs.
 */
export async function fetchCuratedBoardJobs(): Promise<RawJob[]> {
  const BATCH_SIZE = 10;
  const allJobs: RawJob[] = [];

  for (let i = 0; i < CURATED_BOARDS.length; i += BATCH_SIZE) {
    const batch = CURATED_BOARDS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((b) => fetchBoardJobs(b))
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value);
      }
    }
  }

  return allJobs;
}

async function fetchBoardJobs(board: CuratedBoard): Promise<RawJob[]> {
  switch (board.board) {
    case "greenhouse":
      return fetchGreenhouseJobs(board.name, board.slug);
    case "lever":
      return fetchLeverJobs(board.name, board.slug);
    case "ashby":
      return fetchAshbyJobs(board.name, board.slug);
    default:
      return [];
  }
}

// ---------- Adzuna keyword search (optional, needs API keys) ----------

export async function fetchAdzunaJobs(
  titleKeywords: string[],
  descriptionKeywords: string[],
  locations: string[],
  maxResults: number = 100
): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const keywords = [...titleKeywords, ...descriptionKeywords].filter(Boolean);
  if (keywords.length === 0) return [];

  const query = keywords.join(" ");
  const where = locations.length > 0 ? locations[0] : "";
  const perPage = Math.min(maxResults, 50);
  const pages = Math.ceil(maxResults / perPage);

  const allJobs: RawJob[] = [];

  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      what: query,
      results_per_page: String(perPage),
      sort_by: "date",
      max_days_old: "14",
    });
    if (where) params.set("where", where);

    const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?${params}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[adzuna] page ${page} failed: ${res.status} ${res.statusText}`);
        break;
      }
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jobs: RawJob[] = (data.results ?? []).map((j: any) => {
        const location = j.location?.display_name ?? null;
        const isRemote =
          (location ?? "").toLowerCase().includes("remote") ||
          (j.title ?? "").toLowerCase().includes("remote") ||
          (j.description ?? "").toLowerCase().includes("remote");
        return {
          company: j.company?.display_name ?? "Unknown",
          title: j.title ?? "",
          url: j.redirect_url ?? "",
          location,
          date_posted: j.created ?? null,
          source: "adzuna",
          is_remote: isRemote,
          salary_min: j.salary_min ? Math.round(j.salary_min) : null,
          salary_max: j.salary_max ? Math.round(j.salary_max) : null,
          description: j.description ?? null,
        };
      });

      allJobs.push(...jobs);

      if ((data.results ?? []).length < perPage) break;
    } catch (err) {
      console.error(`[adzuna] Error fetching page ${page}:`, err);
      break;
    }
  }

  return allJobs;
}

// ---------- Filtering ----------

import { MatchMode } from "./types";

export function matchesKeywords(
  text: string,
  keywords: string[],
  mode: MatchMode = "OR"
): boolean {
  if (!keywords.length) return true;
  const lower = text.toLowerCase();
  if (mode === "AND") {
    return keywords.every((kw) => lower.includes(kw.toLowerCase()));
  }
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function matchesExcludes(title: string, excludes: string[]): boolean {
  const lower = title.toLowerCase();
  return excludes.some((kw) => lower.includes(kw.toLowerCase()));
}

export function matchesLocation(
  location: string | null,
  isRemote: boolean,
  locationFilters: string[],
  includeRemote: boolean = true,
  includeHybrid: boolean = true
): boolean {
  const locLower = (location ?? "").toLowerCase();
  const isHybrid = locLower.includes("hybrid");
  const isJobRemote = isRemote || locLower.includes("remote");

  // If remote and config says include remote, pass
  if (isJobRemote && includeRemote) return true;
  // If hybrid and config says include hybrid, pass
  if (isHybrid && includeHybrid) return true;

  // If no location filters, accept all non-remote/hybrid jobs too
  if (!locationFilters.length) return true;

  return locationFilters.some((loc) => locLower.includes(loc.toLowerCase()));
}

export function getMatchedKeywords(
  text: string,
  keywords: string[]
): string[] {
  if (!text || !keywords.length) return [];
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
}
