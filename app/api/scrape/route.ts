import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  fetchGreenhouseJobs,
  fetchAshbyJobs,
  matchesKeywords,
  matchesExcludes,
  matchesLocation,
  parseSalary,
  RawJob,
} from "@/lib/scraping";
import { computeSeniorityScore } from "@/lib/utils";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { profileId } = await request.json();
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    // 1. Load companies for this profile
    const { data: companies, error: compErr } = await supabase
      .from("watchlist_companies")
      .select("*")
      .eq("profile_id", profileId);

    if (compErr) {
      return NextResponse.json({ error: compErr.message }, { status: 500 });
    }

    // 2. Load search config
    const { data: configs, error: cfgErr } = await supabase
      .from("search_configs")
      .select("*")
      .eq("profile_id", profileId)
      .limit(1);

    if (cfgErr || !configs?.length) {
      return NextResponse.json(
        { error: cfgErr?.message ?? "No search config found" },
        { status: 500 }
      );
    }

    const config = configs[0];
    const titleKeywords: string[] = config.title_keywords ?? [];
    const excludeKeywords: string[] = config.exclude_keywords ?? [];
    const locations: string[] = config.locations ?? [];

    // 3. Fetch jobs from all companies
    const allRaw: RawJob[] = [];

    for (const co of companies ?? []) {
      const name = co.name ?? "Unknown";
      let jobs: RawJob[] = [];

      if (co.greenhouse_slug) {
        jobs = await fetchGreenhouseJobs(name, co.greenhouse_slug);
      } else if (co.ashby_slug) {
        jobs = await fetchAshbyJobs(name, co.ashby_slug);
      } else {
        continue;
      }

      allRaw.push(...jobs);
    }

    // 4. Filter
    const filtered = allRaw.filter((job) => {
      if (titleKeywords.length && !matchesKeywords(job.title, titleKeywords)) return false;
      if (matchesExcludes(job.title, excludeKeywords)) return false;
      if (!matchesLocation(job.location, job.is_remote, locations)) return false;
      return true;
    });

    // 5. Score seniority and remove entry-level
    const scored = filtered.map((j) => ({
      ...j,
      seniority_score: computeSeniorityScore(j.title, j.description),
    }));
    const senior = scored.filter((j) => j.seniority_score > 0);

    if (senior.length === 0) {
      return NextResponse.json({
        fetched: allRaw.length,
        filtered: filtered.length,
        afterSeniority: 0,
        inserted: 0,
      });
    }

    // 6. Deduplicate against DB
    const urls = senior.map((j) => j.url);
    const { data: existing } = await supabase
      .from("jobs")
      .select("url")
      .in("url", urls);
    const existingUrls = new Set((existing ?? []).map((r: { url: string }) => r.url));
    const newJobs = senior.filter((j) => !existingUrls.has(j.url));

    // Update salary for existing jobs that now have data
    const existingWithSalary = senior.filter(
      (j) => existingUrls.has(j.url) && (j.salary_min || j.salary_max)
    );
    let salaryUpdated = 0;
    for (const j of existingWithSalary) {
      const update: Record<string, string | number | null> = {};
      if (j.salary_min) update.salary_min = j.salary_min;
      if (j.salary_max) update.salary_max = j.salary_max;
      if (j.description) update.description = j.description;
      const { error } = await supabase
        .from("jobs")
        .update(update)
        .eq("url", j.url)
        .is("salary_min", null);
      if (!error) salaryUpdated++;
    }

    // 7. Insert new jobs
    let inserted = 0;
    if (newJobs.length > 0) {
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

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("jobs").insert(batch);
        if (!error) inserted += batch.length;
      }
    }

    // 8. Backfill salaries
    const { data: backfillJobs } = await supabase
      .from("jobs")
      .select("id, description")
      .is("salary_min", null)
      .is("salary_max", null)
      .not("description", "is", null);

    let backfilled = 0;
    for (const job of backfillJobs ?? []) {
      const salary = parseSalary(job.description);
      if (salary.min || salary.max) {
        const { error } = await supabase
          .from("jobs")
          .update({ salary_min: salary.min, salary_max: salary.max })
          .eq("id", job.id);
        if (!error) backfilled++;
      }
    }

    return NextResponse.json({
      fetched: allRaw.length,
      filtered: filtered.length,
      afterSeniority: senior.length,
      alreadyInDb: senior.length - newJobs.length,
      inserted,
      salaryUpdated,
      backfilled,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
