import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface RawJob {
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

function parseSalary(text: string | null): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };

  // Match patterns like $120,000 - $160,000 or $120k-$160k or $120,000/yr
  const patterns = [
    // $120,000 - $160,000
    /\$\s*([\d,]+)\s*(?:[-–—to]+)\s*\$\s*([\d,]+)/gi,
    // $120k - $160k
    /\$\s*(\d+)\s*k\s*(?:[-–—to]+)\s*\$\s*(\d+)\s*k/gi,
    // $120,000/year or /yr (single value)
    /\$\s*([\d,]+)\s*(?:\/\s*(?:year|yr|annually))/gi,
    // $120k (single value near salary context)
    /\$\s*(\d+)\s*k/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      if (match[2]) {
        // Range match
        let min = parseInt(match[1].replace(/,/g, ""), 10);
        let max = parseInt(match[2].replace(/,/g, ""), 10);
        // If values are small (like 120, 160), they're in k
        if (min < 1000) min *= 1000;
        if (max < 1000) max *= 1000;
        if (min >= 20000 && max >= 20000) return { min, max };
      } else {
        // Single value
        let val = parseInt(match[1].replace(/,/g, ""), 10);
        if (val < 1000) val *= 1000;
        if (val >= 20000) return { min: val, max: null };
      }
    }
  }

  return { min: null, max: null };
}

// ---------- API fetchers ----------

async function fetchGreenhouseJobs(
  companyName: string,
  slug: string
): Promise<RawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs ?? []).map((j: any) => {
      const content = j.content ?? "";
      const salary = parseSalary(content);
      return {
        company: companyName,
        title: j.title ?? "",
        url: j.absolute_url ?? `https://boards.greenhouse.io/${slug}/jobs/${j.id}`,
        location: j.location?.name ?? null,
        date_posted: j.updated_at ?? j.first_published_at ?? null,
        source: "greenhouse",
        is_remote:
          (j.location?.name ?? "").toLowerCase().includes("remote") || false,
        salary_min: salary.min,
        salary_max: salary.max,
        description: content || null,
      };
    });
  } catch {
    console.error(`  [greenhouse] Error fetching ${slug}`);
    return [];
  }
}

async function fetchAshbyJobs(
  companyName: string,
  slug: string
): Promise<RawJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.jobs ?? []).map((j: any) => {
      const desc = j.descriptionPlain ?? j.description ?? "";
      // Ashby provides compensation info in the job object
      let salaryMin: number | null = null;
      let salaryMax: number | null = null;
      if (j.compensationTierSummary) {
        const comp = parseSalary(j.compensationTierSummary);
        salaryMin = comp.min;
        salaryMax = comp.max;
      }
      if (!salaryMin && !salaryMax) {
        const comp = parseSalary(desc);
        salaryMin = comp.min;
        salaryMax = comp.max;
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
    console.error(`  [ashby] Error fetching ${slug}`);
    return [];
  }
}

// ---------- Filtering ----------

function matchesKeywords(title: string, keywords: string[]): boolean {
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function matchesExcludes(title: string, excludes: string[]): boolean {
  const lower = title.toLowerCase();
  return excludes.some((kw) => lower.includes(kw.toLowerCase()));
}

function matchesLocation(
  location: string | null,
  isRemote: boolean,
  locationFilters: string[]
): boolean {
  if (!locationFilters.length) return true;
  const locLower = (location ?? "").toLowerCase();
  if (isRemote || locLower.includes("remote")) return true;
  return locationFilters.some((loc) => locLower.includes(loc.toLowerCase()));
}

// ---------- Main ----------

async function main() {
  console.log("=== Job Scraper ===\n");

  // 1. Load watchlist companies
  const { data: companies, error: compErr } = await supabase
    .from("watchlist_companies")
    .select("*");
  if (compErr) {
    console.error("Failed to load companies:", compErr.message);
    process.exit(1);
  }
  console.log(`Loaded ${companies.length} watchlist companies`);

  // 2. Load search config
  const { data: configs, error: cfgErr } = await supabase
    .from("search_configs")
    .select("*")
    .limit(1);
  if (cfgErr || !configs?.length) {
    console.error("Failed to load search config:", cfgErr?.message);
    process.exit(1);
  }
  const config = configs[0];
  const titleKeywords: string[] = config.title_keywords ?? [];
  const excludeKeywords: string[] = config.exclude_keywords ?? [];
  const locations: string[] = config.locations ?? [];

  console.log(`Keywords: ${titleKeywords.join(", ")}`);
  console.log(`Exclude: ${excludeKeywords.join(", ")}`);
  console.log(`Locations: ${locations.join(", ")}\n`);

  // 3. Fetch jobs from all companies
  let allRaw: RawJob[] = [];

  for (const co of companies) {
    const name = co.name ?? "Unknown";
    let jobs: RawJob[] = [];

    if (co.greenhouse_slug) {
      console.log(`Fetching ${name} (greenhouse: ${co.greenhouse_slug})...`);
      jobs = await fetchGreenhouseJobs(name, co.greenhouse_slug);
    } else if (co.ashby_slug) {
      console.log(`Fetching ${name} (ashby: ${co.ashby_slug})...`);
      jobs = await fetchAshbyJobs(name, co.ashby_slug);
    } else {
      console.log(`Skipping ${name} (no supported slug)`);
      continue;
    }

    console.log(`  -> ${jobs.length} total postings`);
    allRaw.push(...jobs);
  }

  console.log(`\nTotal raw jobs fetched: ${allRaw.length}`);

  // 4. Filter by keywords, excludes, and location
  const filtered = allRaw.filter((job) => {
    if (!matchesKeywords(job.title, titleKeywords)) return false;
    if (matchesExcludes(job.title, excludeKeywords)) return false;
    if (!matchesLocation(job.location, job.is_remote, locations)) return false;
    return true;
  });

  console.log(`After filtering: ${filtered.length} matching jobs\n`);

  if (filtered.length === 0) {
    console.log("No matching jobs found.");
    return;
  }

  // 5. Deduplicate against existing jobs by URL
  const urls = filtered.map((j) => j.url);
  const { data: existing } = await supabase
    .from("jobs")
    .select("url")
    .in("url", urls);
  const existingUrls = new Set((existing ?? []).map((r: any) => r.url));
  const newJobs = filtered.filter((j) => !existingUrls.has(j.url));

  console.log(`Already in DB: ${filtered.length - newJobs.length}`);
  console.log(`New jobs to insert: ${newJobs.length}\n`);

  if (newJobs.length === 0) {
    console.log("No new jobs to insert.");
    return;
  }

  // 6. Insert new jobs
  const rows = newJobs.map((j) => ({
    company: j.company,
    title: j.title,
    url: j.url,
    location: j.location,
    date_posted: j.date_posted,
    source: j.source,
    is_remote: j.is_remote,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    description: j.description,
    is_dismissed: false,
  }));

  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error: insErr } = await supabase.from("jobs").insert(batch);
    if (insErr) {
      console.error(`Insert error (batch ${i}):`, insErr.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Successfully inserted ${inserted} new jobs!`);

  // 7. Print summary by company
  console.log("\n--- Summary by Company ---");
  const byCompany = new Map<string, number>();
  for (const j of newJobs) {
    byCompany.set(j.company, (byCompany.get(j.company) ?? 0) + 1);
  }
  for (const [company, count] of [...byCompany.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${company}: ${count}`);
  }
}

main().catch(console.error);
