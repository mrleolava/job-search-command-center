"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Job, WatchlistCompany, SearchConfig } from "@/lib/types";
import { PROFILE_ID, PROFILE_SLUG } from "@/lib/profile";
import FilterBar, { FilterState } from "./FilterBar";
import JobList from "./JobList";
import { getMatchedKeywords } from "@/lib/scraping";
import { isHybridLocation } from "@/lib/locations";

const PE_RANK: Record<string, number> = {
  "Core (>50%)": 0,
  "Significant (20-50%)": 1,
  "Emerging (<20%)": 2,
  "None/Unknown": 3,
};

const FUNDING_RANK: Record<string, number> = {
  "Series D+": 0, "PE-backed": 1, "Series C": 2, "Series B": 3,
  "Series A": 4, "Seed": 5, "Public": 6, "Private/Bootstrapped": 7,
};

function parseFiltersFromParams(params: URLSearchParams): FilterState {
  return {
    search: params.get("q") ?? "",
    sortBy: params.get("sort") ?? "date",
    locations: params.get("loc") ? params.get("loc")!.split(",") : [],
    companies: params.get("co") ? params.get("co")!.split(",") : [],
    dateRange: params.get("date") ?? "",
    minSalary: Number(params.get("minSal")) || 0,
    maxSalary: Number(params.get("maxSal")) || 0,
    hideNoSalary: params.get("noSal") === "1",
    minSeniority: Number(params.get("sen")) || 1,
    remoteOnly: params.get("remote") === "1",
    hybridOnly: params.get("hybrid") === "1",
    activeCompaniesOnly: params.get("activeCo") !== "0",
    showDismissed: params.get("dismissed") === "1",
    peExposure: params.get("pe") ? params.get("pe")!.split("|") : [],
    fundingStages: params.get("fund") ? params.get("fund")!.split("|") : [],
    revenueStages: params.get("rev") ? params.get("rev")!.split("|") : [],
    minGrowth: params.get("growth") ?? "",
    minGlassdoor: params.get("gd") ?? "",
  };
}

function serializeFiltersToParams(f: FilterState): string {
  const p = new URLSearchParams();
  if (f.search) p.set("q", f.search);
  if (f.sortBy !== "date") p.set("sort", f.sortBy);
  if (f.locations.length) p.set("loc", f.locations.join(","));
  if (f.companies.length) p.set("co", f.companies.join(","));
  if (f.dateRange) p.set("date", f.dateRange);
  if (f.minSalary) p.set("minSal", String(f.minSalary));
  if (f.maxSalary) p.set("maxSal", String(f.maxSalary));
  if (f.hideNoSalary) p.set("noSal", "1");
  if (f.minSeniority > 1) p.set("sen", String(f.minSeniority));
  if (f.remoteOnly) p.set("remote", "1");
  if (f.hybridOnly) p.set("hybrid", "1");
  if (!f.activeCompaniesOnly) p.set("activeCo", "0");
  if (f.showDismissed) p.set("dismissed", "1");
  if (f.peExposure.length) p.set("pe", f.peExposure.join("|"));
  if (f.fundingStages.length) p.set("fund", f.fundingStages.join("|"));
  if (f.revenueStages.length) p.set("rev", f.revenueStages.join("|"));
  if (f.minGrowth) p.set("growth", f.minGrowth);
  if (f.minGlassdoor) p.set("gd", f.minGlassdoor);
  const str = p.toString();
  return str ? `?${str}` : "";
}

export default function JobFeed() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [watchlistCompanies, setWatchlistCompanies] = useState<WatchlistCompany[]>([]);
  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromParams(searchParams)
  );

  const updateFilters = useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters);
      const paramStr = serializeFiltersToParams(newFilters);
      router.replace(`/feed${paramStr}`, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    fetchJobs();
    fetchProfileData();
  }, []);

  async function fetchJobs() {
    const supabase = createClient();
    const [jobsRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("*").gt("seniority_score", 0),
      supabase.from("applications").select("job_id"),
    ]);
    if (jobsRes.data) setJobs(jobsRes.data as Job[]);
    if (appsRes.data) {
      const ids = new Set<string>();
      appsRes.data.forEach((a) => ids.add(a.job_id));
      setSavedJobIds(ids);
    }
    setLoading(false);
  }

  async function fetchProfileData() {
    const supabase = createClient();
    const [compRes, cfgRes] = await Promise.all([
      supabase.from("watchlist_companies").select("*").eq("profile_id", PROFILE_ID).order("name"),
      supabase.from("search_configs").select("*").eq("profile_id", PROFILE_ID).limit(1),
    ]);
    setWatchlistCompanies(compRes.data ?? []);
    setSearchConfig(cfgRes.data?.[0] ?? null);
  }

  const companySearchEnabled = searchConfig?.company_search_enabled ?? true;

  // Build lookup map: company name (lowercase) -> WatchlistCompany
  const companyIntelMap = useMemo(() => {
    const map = new Map<string, WatchlistCompany>();
    for (const co of watchlistCompanies) {
      map.set(co.name.toLowerCase(), co);
    }
    return map;
  }, [watchlistCompanies]);

  const watchlistNames = useMemo(
    () => new Set(watchlistCompanies.map((c) => c.name.toLowerCase())),
    [watchlistCompanies]
  );

  const activeWatchlistNames = useMemo(
    () => new Set(watchlistCompanies.filter((c) => c.is_active).map((c) => c.name.toLowerCase())),
    [watchlistCompanies]
  );

  const titleKeywords = useMemo(
    () => (searchConfig?.title_keywords ?? []).map((k) => k.toLowerCase()),
    [searchConfig]
  );
  const descriptionKeywords = useMemo(
    () => (searchConfig?.description_keywords ?? []).map((k) => k.toLowerCase()),
    [searchConfig]
  );
  const titleMatchMode = searchConfig?.title_match_mode ?? "OR";
  const descriptionMatchMode = searchConfig?.description_match_mode ?? "OR";
  const crossMatchMode = searchConfig?.cross_match_mode ?? "AND";

  // Build normalized location list with counts
  const { allLocations, locationCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const job of jobs) {
      const norm = job.normalized_location;
      if (!norm) continue;
      for (const city of norm.split(",")) {
        if (city) counts[city] = (counts[city] ?? 0) + 1;
      }
    }
    // Sort by count descending
    const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { allLocations: sorted, locationCounts: counts };
  }, [jobs]);
  const allCompanies = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.company).filter(Boolean) as string[])).sort(),
    [jobs]
  );

  const hasWatchlist = watchlistCompanies.length > 0;

  // Config-level filtering
  const configFilteredJobs = useMemo(() => {
    if (companySearchEnabled) {
      if (!hasWatchlist) return [];
      return jobs.filter((job) => {
        if (!job.company || !watchlistNames.has(job.company.toLowerCase())) return false;

        if (job.title) {
          const excludes = searchConfig?.exclude_keywords ?? [];
          const titleLower = job.title.toLowerCase();
          if (excludes.some((kw) => titleLower.includes(kw.toLowerCase()))) return false;
        }

        const hasTitleKw = titleKeywords.length > 0;
        const hasDescKw = descriptionKeywords.length > 0;
        if (hasTitleKw || hasDescKw) {
          const titleMatch = !hasTitleKw || (() => {
            if (!job.title) return false;
            const lower = job.title.toLowerCase();
            return titleMatchMode === "AND"
              ? titleKeywords.every((kw) => lower.includes(kw))
              : titleKeywords.some((kw) => lower.includes(kw));
          })();
          const descMatch = !hasDescKw || (() => {
            // Auto-pass if description is empty (don't penalize missing data)
            if (!job.description || job.description.trim().length === 0) return true;
            const lower = job.description.toLowerCase();
            return descriptionMatchMode === "AND"
              ? descriptionKeywords.every((kw) => lower.includes(kw))
              : descriptionKeywords.some((kw) => lower.includes(kw));
          })();
          if (crossMatchMode === "AND") {
            if (!titleMatch || !descMatch) return false;
          } else {
            if (!titleMatch && !descMatch) return false;
          }
        }

        return true;
      });
    } else {
      // KEYWORD MODE: apply exclude keywords AND title/description keyword matching
      const excludes = (searchConfig?.exclude_keywords ?? []).map((k) => k.toLowerCase());
      return jobs.filter((job) => {
        if (job.title && excludes.length > 0) {
          const titleLower = job.title.toLowerCase();
          if (excludes.some((kw) => titleLower.includes(kw))) return false;
        }

        const hasTitleKw = titleKeywords.length > 0;
        const hasDescKw = descriptionKeywords.length > 0;
        if (hasTitleKw || hasDescKw) {
          const titleMatch = !hasTitleKw || (() => {
            if (!job.title) return false;
            const lower = job.title.toLowerCase();
            return titleMatchMode === "AND"
              ? titleKeywords.every((kw) => lower.includes(kw))
              : titleKeywords.some((kw) => lower.includes(kw));
          })();
          const descMatch = !hasDescKw || (() => {
            // Auto-pass if description is empty (don't penalize missing data)
            if (!job.description || job.description.trim().length === 0) return true;
            const lower = job.description.toLowerCase();
            return descriptionMatchMode === "AND"
              ? descriptionKeywords.every((kw) => lower.includes(kw))
              : descriptionKeywords.some((kw) => lower.includes(kw));
          })();
          if (crossMatchMode === "AND") {
            if (!titleMatch || !descMatch) return false;
          } else {
            if (!titleMatch && !descMatch) return false;
          }
        }

        return true;
      });
    }
  }, [jobs, companySearchEnabled, hasWatchlist, watchlistNames, titleKeywords, descriptionKeywords, titleMatchMode, descriptionMatchMode, crossMatchMode, searchConfig]);

  // Apply user filters (including company intelligence filters)
  const filteredJobs = useMemo(() => {
    const f = filters;
    const result = configFilteredJobs.filter((job) => {
      if (!f.showDismissed && job.is_dismissed) return false;
      if ((job.seniority_score ?? 0) < f.minSeniority) return false;

      // Active companies filter
      if (f.activeCompaniesOnly && companySearchEnabled && job.company) {
        if (!activeWatchlistNames.has(job.company.toLowerCase())) return false;
      }

      if (f.search) {
        const q = f.search.toLowerCase();
        const match =
          job.title?.toLowerCase().includes(q) ||
          job.company?.toLowerCase().includes(q) ||
          job.description?.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (f.locations.length > 0) {
        const normCities = job.normalized_location?.split(",") ?? [];
        if (!f.locations.some((loc) => normCities.includes(loc))) return false;
      }

      if (f.companies.length > 0) {
        if (!job.company || !f.companies.includes(job.company)) return false;
      }

      if (f.minSalary > 0) {
        const salaryVal = job.salary_max ?? job.salary_min ?? 0;
        if (salaryVal < f.minSalary * 1000) return false;
      }
      if (f.maxSalary > 0) {
        const salaryVal = job.salary_min ?? job.salary_max ?? 0;
        if (salaryVal > f.maxSalary * 1000) return false;
      }
      if (f.hideNoSalary) {
        if (!job.salary_min && !job.salary_max) return false;
      }

      if (f.remoteOnly && !job.is_remote) return false;
      if (f.hybridOnly && !isHybridLocation(job.location)) return false;

      if (f.dateRange && job.date_posted) {
        const daysAgo = Math.floor(
          (Date.now() - new Date(job.date_posted).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysAgo > Number(f.dateRange)) return false;
      }

      // Company intelligence filters
      const intel = job.company ? companyIntelMap.get(job.company.toLowerCase()) : null;

      if (f.peExposure.length > 0) {
        if (!intel?.pe_revenue_exposure || !f.peExposure.includes(intel.pe_revenue_exposure)) return false;
      }
      if (f.fundingStages.length > 0) {
        if (!intel?.funding_stage || !f.fundingStages.includes(intel.funding_stage)) return false;
      }
      if (f.revenueStages.length > 0) {
        if (!intel?.revenue_stage || !f.revenueStages.includes(intel.revenue_stage)) return false;
      }
      if (f.minGrowth) {
        const threshold = Number(f.minGrowth);
        if ((intel?.employee_growth_6m ?? 0) <= threshold) return false;
      }
      if (f.minGlassdoor) {
        const threshold = Number(f.minGlassdoor);
        if ((intel?.glassdoor_rating ?? 0) <= threshold) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const intelA = a.company ? companyIntelMap.get(a.company.toLowerCase()) : null;
      const intelB = b.company ? companyIntelMap.get(b.company.toLowerCase()) : null;

      switch (f.sortBy) {
        case "date": {
          const da = a.date_posted ? new Date(a.date_posted).getTime() : 0;
          const db = b.date_posted ? new Date(b.date_posted).getTime() : 0;
          return db - da;
        }
        case "salary": {
          const sa = a.salary_max ?? a.salary_min ?? 0;
          const sb = b.salary_max ?? b.salary_min ?? 0;
          return sb - sa;
        }
        case "seniority":
          return (b.seniority_score ?? 0) - (a.seniority_score ?? 0);
        case "companyAZ":
          return (a.company ?? "").localeCompare(b.company ?? "");
        case "companyZA":
          return (b.company ?? "").localeCompare(a.company ?? "");
        case "titleAZ":
          return (a.title ?? "").localeCompare(b.title ?? "");
        case "titleZA":
          return (b.title ?? "").localeCompare(a.title ?? "");
        case "relevance": {
          const scoreA = (a.seniority_score ?? 0) * 10000 + (a.salary_max ?? a.salary_min ?? 0);
          const scoreB = (b.seniority_score ?? 0) * 10000 + (b.salary_max ?? b.salary_min ?? 0);
          return scoreB - scoreA;
        }
        case "companyFit":
          return (intelB?.company_fit_score ?? 0) - (intelA?.company_fit_score ?? 0);
        case "peExposure": {
          const rankA = PE_RANK[intelA?.pe_revenue_exposure ?? ""] ?? 99;
          const rankB = PE_RANK[intelB?.pe_revenue_exposure ?? ""] ?? 99;
          return rankA - rankB;
        }
        case "employeeGrowth":
          return (intelB?.employee_growth_6m ?? -999) - (intelA?.employee_growth_6m ?? -999);
        case "glassdoor":
          return (intelB?.glassdoor_rating ?? 0) - (intelA?.glassdoor_rating ?? 0);
        case "fundingStage": {
          const rankA = FUNDING_RANK[intelA?.funding_stage ?? ""] ?? 99;
          const rankB = FUNDING_RANK[intelB?.funding_stage ?? ""] ?? 99;
          return rankA - rankB;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [configFilteredJobs, filters, companyIntelMap, activeWatchlistNames, companySearchEnabled]);

  const jobMatchedKeywords = useMemo(() => {
    const map = new Map<string, { title: string[]; description: string[] }>();
    const allTitleKw = searchConfig?.title_keywords ?? [];
    const allDescKw = searchConfig?.description_keywords ?? [];
    for (const job of filteredJobs) {
      map.set(job.id, {
        title: getMatchedKeywords(job.title ?? "", allTitleKw),
        description: getMatchedKeywords(job.description ?? "", allDescKw),
      });
    }
    return map;
  }, [filteredJobs, searchConfig]);

  async function handleSave(job: Job) {
    const supabase = createClient();
    const { error } = await supabase
      .from("applications")
      .insert({ job_id: job.id, stage: "saved", profile: PROFILE_SLUG });
    if (!error) {
      setSavedJobIds((prev) => new Set(prev).add(job.id));
    }
  }

  async function handleDismiss(job: Job) {
    const newDismissed = !job.is_dismissed;
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_dismissed: newDismissed } : j))
    );
    const supabase = createClient();
    await supabase.from("jobs").update({ is_dismissed: newDismissed }).eq("id", job.id);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-6">
        <p className="text-claude-tertiary text-center py-16">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-4 px-6">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-base font-semibold text-claude-primary">
          Job Feed
          <span className="text-claude-tertiary font-normal ml-1.5">
            &middot; {filteredJobs.length} results
          </span>
        </h1>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          companySearchEnabled
            ? "bg-claude-accent-light text-claude-accent"
            : "bg-violet-100 text-violet-700"
        }`}>
          {companySearchEnabled ? "Company" : "Keyword"}
        </span>
      </div>

      <FilterBar
        filters={filters}
        onChange={updateFilters}
        allLocations={allLocations}
        locationCounts={locationCounts}
        allCompanies={allCompanies}
        totalCount={configFilteredJobs.length}
        filteredCount={filteredJobs.length}
      />

      {companySearchEnabled && !hasWatchlist ? (
        <div className="text-center py-16">
          <p className="text-claude-secondary">No companies in your watchlist yet.</p>
          <p className="text-claude-tertiary text-sm mt-1">
            Go to <a href="/settings" className="text-claude-accent hover:underline">Settings</a> to add companies.
          </p>
        </div>
      ) : (
        <JobList
          jobs={filteredJobs}
          savedJobIds={savedJobIds}
          onSave={handleSave}
          onDismiss={handleDismiss}
          matchedKeywords={jobMatchedKeywords}
          companyIntelMap={companyIntelMap}
        />
      )}
    </div>
  );
}
