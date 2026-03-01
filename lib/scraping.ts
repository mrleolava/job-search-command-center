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

// ---------- Filtering ----------

export function matchesKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

export function matchesExcludes(title: string, excludes: string[]): boolean {
  const lower = title.toLowerCase();
  return excludes.some((kw) => lower.includes(kw.toLowerCase()));
}

export function matchesLocation(
  location: string | null,
  isRemote: boolean,
  locationFilters: string[]
): boolean {
  if (!locationFilters.length) return true;
  const locLower = (location ?? "").toLowerCase();
  if (isRemote || locLower.includes("remote")) return true;
  return locationFilters.some((loc) => locLower.includes(loc.toLowerCase()));
}
