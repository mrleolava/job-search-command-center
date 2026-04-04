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

export function parseSalary(text: string | null): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };

  const clean = text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");

  // "$120k - $160k"
  let m = clean.match(/\$\s*(\d+)\s*[kK]\s*[-–—]+\s*\$\s*(\d+)\s*[kK]/);
  if (m) return { min: +m[1] * 1000, max: +m[2] * 1000 };

  // "$120-160k"
  m = clean.match(/\$\s*(\d+)\s*[-–—]+\s*(\d+)\s*[kK]/);
  if (m) {
    const v1 = +m[1], v2 = +m[2];
    if (v1 < 1000 && v2 < 1000) return { min: v1 * 1000, max: v2 * 1000 };
  }

  // "$120,000 - $160,000"
  m = clean.match(/\$\s*([\d,]+)\s*(?:[-–—]+|to)\s*\$\s*([\d,]+)/i);
  if (m) {
    const v1 = parseInt(m[1].replace(/,/g, ""), 10);
    const v2 = parseInt(m[2].replace(/,/g, ""), 10);
    if (v1 >= 20000 && v2 >= 20000) return { min: v1, max: v2 };
  }

  // "$150,000 base" or "$150,000/yr"
  m = clean.match(/\$\s*([\d,]+)\s*(?:\/\s*(?:year|yr|annually)|per\s+(?:year|annum)|base|annually)/i);
  if (m) {
    const v = parseInt(m[1].replace(/,/g, ""), 10);
    if (v >= 20000) return { min: v, max: null };
  }

  // Standalone "$120k" near salary context
  const salaryContext = /(?:salary|compensation|pay|earning|ote|base|annual|total\s+comp)/i;
  if (salaryContext.test(clean)) {
    m = clean.match(/\$\s*(\d+)\s*[kK]/);
    if (m) {
      const v = +m[1] * 1000;
      if (v >= 20000) return { min: v, max: null };
    }
  }

  return { min: null, max: null };
}

// ---------- API fetchers ----------

export async function fetchGreenhouseJobs(
  companyName: string,
  slug: string
): Promise<RawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs ?? []).map(// eslint-disable-next-line @typescript-eslint/no-explicit-any
    (j: any) => {
      const content = j.content ?? "";
      const salary = parseSalary(content);
      return {
        company: companyName,
        title: j.title ?? "",
        url: j.absolute_url ?? `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
        location: j.location?.name ?? null,
        date_posted: j.updated_at ?? j.first_published_at ?? null,
        source: "greenhouse",
        is_remote: (j.location?.name ?? "").toLowerCase().includes("remote") || false,
        salary_min: salary.min,
        salary_max: salary.max,
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
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.jobs ?? []).map((j: any) => {
      const desc = j.descriptionPlain ?? "";
      const descHtml = j.descriptionHtml ?? "";
      const salary = parseSalary(desc) ?? parseSalary(descHtml);
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
        salary_min: salary.min,
        salary_max: salary.max,
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
      const salary = parseSalary(fullText);
      const location = j.categories?.location ?? null;
      return {
        company: companyName,
        title: j.text ?? "",
        url: j.hostedUrl ?? `https://jobs.lever.co/${slug}/${j.id}`,
        location,
        date_posted: j.createdAt ? new Date(j.createdAt).toISOString() : null,
        source: "lever",
        is_remote: (location ?? "").toLowerCase().includes("remote"),
        salary_min: salary.min,
        salary_max: salary.max,
        description: desc || null,
      };
    });
  } catch {
    console.error(`[lever] Error fetching ${slug}`);
    return [];
  }
}

// ---------- Adzuna keyword search ----------

export async function fetchAdzunaJobs(
  titleKeywords: string[],
  descriptionKeywords: string[],
  locations: string[],
  includeRemote: boolean,
  maxResults: number = 100
): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error(
      "ADZUNA_APP_ID and ADZUNA_APP_KEY env vars are required for keyword search mode"
    );
  }

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
