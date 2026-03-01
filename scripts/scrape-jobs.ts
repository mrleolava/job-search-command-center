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

function toAnnual(val: number): number {
  // Normalize: if value looks like shorthand (e.g. 120 for $120k), multiply
  if (val > 0 && val < 1000) return val * 1000;
  return val;
}

function parseSalary(text: string | null): { min: number | null; max: number | null } {
  if (!text) return { min: null, max: null };

  // Strip HTML tags for clean matching
  const clean = text.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");

  // 1. "$120k - $160k" or "$120K-$160K"
  let m = clean.match(/\$\s*(\d+)\s*[kK]\s*[-–—]+\s*\$\s*(\d+)\s*[kK]/);
  if (m) return { min: +m[1] * 1000, max: +m[2] * 1000 };

  // 2. "$120-160k" (shorthand range, single $)
  m = clean.match(/\$\s*(\d+)\s*[-–—]+\s*(\d+)\s*[kK]/);
  if (m) {
    const v1 = +m[1], v2 = +m[2];
    if (v1 < 1000 && v2 < 1000) return { min: v1 * 1000, max: v2 * 1000 };
  }

  // 3. "$120,000 - $160,000" or "$120,000 to $160,000" or "$172,300--$222,800"
  m = clean.match(/\$\s*([\d,]+)\s*(?:[-–—]+|to)\s*\$\s*([\d,]+)/i);
  if (m) {
    const v1 = parseInt(m[1].replace(/,/g, ""), 10);
    const v2 = parseInt(m[2].replace(/,/g, ""), 10);
    if (v1 >= 20000 && v2 >= 20000) return { min: v1, max: v2 };
  }

  // 4. "$150,000 base" or "$150,000/yr" or "$120,000 per year" (single value with context)
  m = clean.match(/\$\s*([\d,]+)\s*(?:\/\s*(?:year|yr|annually)|per\s+(?:year|annum)|base|annually)/i);
  if (m) {
    const v = parseInt(m[1].replace(/,/g, ""), 10);
    if (v >= 20000) return { min: v, max: null };
  }

  // 5. Standalone "$120k" or "$120K" near salary context words
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
      // Ashby: salary is only in the description text
      const desc = j.descriptionPlain ?? "";
      const descHtml = j.descriptionHtml ?? "";
      // Try plain text first, fall back to HTML
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
    console.error(`  [ashby] Error fetching ${slug}`);
    return [];
  }
}

// ---------- Seniority scoring ----------

const ENTRY_LEVEL_TITLE_SIGNALS = [
  "entry level", "entry-level", "junior", "associate", "intern", "internship",
  "new grad", "graduate", "coordinator", "assistant", "analyst",
  "specialist", "development representative",
];

function computeSeniorityScore(title: string, description: string | null): number {
  const t = title.toLowerCase();
  const d = (description ?? "").toLowerCase();

  for (const signal of ENTRY_LEVEL_TITLE_SIGNALS) {
    if (t.includes(signal)) return 0;
  }
  if (/\b(bdr|sdr)\b/i.test(t)) return 0;

  if (/\b0[-–]2\s*years/i.test(d) || /\b1[-–]2\s*years/i.test(d) ||
      /\b0[-–]3\s*years/i.test(d) || /\b1[-–]3\s*years/i.test(d) ||
      /\b2[-–]4\s*years/i.test(d)) return 0;

  let score = 0;
  if (/\b(chief|cro|coo|cfo|ceo|cmo|cto|svp|senior vice president)\b/i.test(t) ||
      /\bhead of\b/i.test(t)) {
    score = 5;
  } else if (/\b(vp|vice president)\b/i.test(t)) {
    score = 4;
  } else if (/\bdirector\b/i.test(t)) {
    score = 3;
  } else if (/\b(senior|lead|manager)\b/i.test(t)) {
    score = 2;
  } else if (/\b(enterprise|strategic)\b/i.test(t)) {
    score = 1;
  } else {
    const hasExp = /\b[5-9]\+?\s*years/i.test(d) || /\b(?:10|12|15)\+?\s*years/i.test(d);
    score = hasExp ? 1 : 0;
  }

  if (score > 0 && score < 5) {
    if (/\b(?:10|12|15)\+?\s*years/i.test(d)) score = Math.min(5, score + 2);
    else if (/\b[7-9]\+?\s*years/i.test(d)) score = Math.min(5, score + 1);
  }

  return score;
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

  // 4. Filter by keywords, excludes, location, and seniority
  const filtered = allRaw.filter((job) => {
    if (!matchesKeywords(job.title, titleKeywords)) return false;
    if (matchesExcludes(job.title, excludeKeywords)) return false;
    if (!matchesLocation(job.location, job.is_remote, locations)) return false;
    return true;
  });

  console.log(`After keyword/location filtering: ${filtered.length}`);

  // Score seniority and remove score=0
  const scored = filtered.map((j) => ({
    ...j,
    seniority_score: computeSeniorityScore(j.title, j.description),
  }));
  const senior = scored.filter((j) => j.seniority_score > 0);
  console.log(`After seniority filtering: ${senior.length} (removed ${scored.length - senior.length} entry-level/unclear)\n`);

  if (senior.length === 0) {
    console.log("No matching jobs found.");
    await backfillSalaries();
    return;
  }

  // 5. Deduplicate against existing jobs by URL
  const urls = senior.map((j) => j.url);
  const { data: existing } = await supabase
    .from("jobs")
    .select("url")
    .in("url", urls);
  const existingUrls = new Set((existing ?? []).map((r: any) => r.url));
  const newJobs = senior.filter((j) => !existingUrls.has(j.url));

  // Update salary/description for existing jobs that now have salary data from API
  const existingWithSalary = senior.filter(
    (j) => existingUrls.has(j.url) && (j.salary_min || j.salary_max)
  );
  if (existingWithSalary.length > 0) {
    let salaryUpdated = 0;
    for (const j of existingWithSalary) {
      const update: Record<string, any> = {};
      if (j.salary_min) update.salary_min = j.salary_min;
      if (j.salary_max) update.salary_max = j.salary_max;
      if (j.description) update.description = j.description;
      const { error: upErr } = await supabase
        .from("jobs")
        .update(update)
        .eq("url", j.url)
        .is("salary_min", null);
      if (!upErr) salaryUpdated++;
    }
    console.log(`Updated salary for ${salaryUpdated} existing jobs from API data`);
  }

  console.log(`Already in DB: ${senior.length - newJobs.length}`);
  console.log(`New jobs to insert: ${newJobs.length}\n`);

  if (newJobs.length === 0) {
    console.log("No new jobs to insert.");
    await backfillSalaries();
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
    seniority_score: j.seniority_score,
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

  // 8. Backfill: update existing jobs that have descriptions but no salary
  await backfillSalaries();
}

async function backfillSalaries() {
  console.log("\n=== Backfilling salaries for existing jobs ===");

  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, description, salary_min, salary_max")
    .is("salary_min", null)
    .is("salary_max", null)
    .not("description", "is", null);

  if (error || !jobs) {
    console.error("Failed to load jobs for backfill:", error?.message);
    return;
  }

  console.log(`Found ${jobs.length} jobs with descriptions but no salary`);

  let updated = 0;
  for (const job of jobs) {
    const salary = parseSalary(job.description);
    if (salary.min || salary.max) {
      const { error: upErr } = await supabase
        .from("jobs")
        .update({ salary_min: salary.min, salary_max: salary.max })
        .eq("id", job.id);
      if (!upErr) updated++;
    }
  }

  console.log(`Updated salary data for ${updated} existing jobs`);
}

main().catch(console.error);
