"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Job, WatchlistCompany, SearchConfig } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import ProfileSwitcher from "@/components/settings/ProfileSwitcher";
import FilterBar, { FilterState } from "./FilterBar";
import JobList from "./JobList";
import { getMatchedKeywords } from "@/lib/scraping";

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
    showDismissed: params.get("dismissed") === "1",
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
  if (f.showDismissed) p.set("dismissed", "1");
  const str = p.toString();
  return str ? `?${str}` : "";
}

export default function JobFeed() {
  const { profiles, profileId, setProfileId, profileSlug, loading: profileLoading } = useProfile();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [watchlistCompanies, setWatchlistCompanies] = useState<WatchlistCompany[]>([]);
  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize filters from URL params
  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromParams(searchParams)
  );

  // Sync filters to URL
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
  }, []);

  useEffect(() => {
    if (profileId) fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

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
      supabase.from("watchlist_companies").select("*").eq("profile_id", profileId).order("name"),
      supabase.from("search_configs").select("*").eq("profile_id", profileId).limit(1),
    ]);
    setWatchlistCompanies(compRes.data ?? []);
    setSearchConfig(cfgRes.data?.[0] ?? null);
  }

  const watchlistNames = useMemo(
    () => new Set(watchlistCompanies.map((c) => c.name.toLowerCase())),
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

  // Derive unique values for filter dropdowns (from watchlist-filtered jobs)
  const allLocations = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean) as string[])).sort(),
    [jobs]
  );
  const allCompanies = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.company).filter(Boolean) as string[])).sort(),
    [jobs]
  );

  const hasWatchlist = watchlistCompanies.length > 0;

  // Total count (before user filters, but after watchlist + keyword config)
  const watchlistFilteredJobs = useMemo(() => {
    if (!hasWatchlist) return [];
    return jobs.filter((job) => {
      if (!job.company || !watchlistNames.has(job.company.toLowerCase())) return false;

      // Exclude keywords
      if (job.title) {
        const excludes = searchConfig?.exclude_keywords ?? [];
        const titleLower = job.title.toLowerCase();
        if (excludes.some((kw) => titleLower.includes(kw.toLowerCase()))) return false;
      }

      // Config keyword matching
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
          if (!job.description) return false;
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
  }, [jobs, hasWatchlist, watchlistNames, titleKeywords, descriptionKeywords, titleMatchMode, descriptionMatchMode, crossMatchMode, searchConfig]);

  // Apply user filters
  const filteredJobs = useMemo(() => {
    const f = filters;
    const result = watchlistFilteredJobs.filter((job) => {
      if (!f.showDismissed && job.is_dismissed) return false;
      if ((job.seniority_score ?? 0) < f.minSeniority) return false;

      if (f.search) {
        const q = f.search.toLowerCase();
        const match =
          job.title?.toLowerCase().includes(q) ||
          job.company?.toLowerCase().includes(q) ||
          job.description?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Location multi-select
      if (f.locations.length > 0) {
        if (!job.location || !f.locations.some((loc) => job.location === loc)) return false;
      }

      // Company multi-select
      if (f.companies.length > 0) {
        if (!job.company || !f.companies.includes(job.company)) return false;
      }

      // Salary
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

      if (f.dateRange && job.date_posted) {
        const daysAgo = Math.floor(
          (Date.now() - new Date(job.date_posted).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysAgo > Number(f.dateRange)) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
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
        case "company":
          return (a.company ?? "").localeCompare(b.company ?? "");
        case "relevance": {
          const scoreA = (a.seniority_score ?? 0) * 10000 + (a.salary_max ?? a.salary_min ?? 0);
          const scoreB = (b.seniority_score ?? 0) * 10000 + (b.salary_max ?? b.salary_min ?? 0);
          return scoreB - scoreA;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [watchlistFilteredJobs, filters]);

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
      .insert({ job_id: job.id, stage: "saved", profile: profileSlug });
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

  if (loading || profileLoading) {
    return (
      <div className="max-w-5xl mx-auto py-8 px-6">
        <p className="text-gray-500 text-center py-16">Loading jobs...</p>
      </div>
    );
  }

  const hasTitleKw = titleKeywords.length > 0;
  const hasDescKw = descriptionKeywords.length > 0;

  return (
    <div className="max-w-5xl mx-auto py-6 px-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Job Feed</h1>
        <ProfileSwitcher
          profiles={profiles}
          activeProfileId={profileId}
          onSwitch={setProfileId}
        />
      </div>

      <FilterBar
        filters={filters}
        onChange={updateFilters}
        allLocations={allLocations}
        allCompanies={allCompanies}
        totalCount={watchlistFilteredJobs.length}
        filteredCount={filteredJobs.length}
      />

      {/* Keyword config indicator */}
      {(hasTitleKw || hasDescKw) && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-4 text-xs text-blue-700 flex flex-wrap items-center gap-1">
          <span className="font-medium">Config:</span>
          {hasTitleKw && (
            <span>
              Title matches {titleMatchMode === "OR" ? "any" : "all"} of{" "}
              {(searchConfig?.title_keywords ?? []).map((kw, i) => (
                <span key={kw}>
                  {i > 0 && <span className="text-blue-400"> {titleMatchMode === "OR" ? "or" : "&"} </span>}
                  <span className="font-medium">&ldquo;{kw}&rdquo;</span>
                </span>
              ))}
            </span>
          )}
          {hasTitleKw && hasDescKw && (
            <span className="font-bold text-blue-500 mx-1">{crossMatchMode}</span>
          )}
          {hasDescKw && (
            <span>
              Description matches {descriptionMatchMode === "OR" ? "any" : "all"} of{" "}
              {(searchConfig?.description_keywords ?? []).map((kw, i) => (
                <span key={kw}>
                  {i > 0 && <span className="text-blue-400"> {descriptionMatchMode === "OR" ? "or" : "&"} </span>}
                  <span className="font-medium">&ldquo;{kw}&rdquo;</span>
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      {!hasWatchlist ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No companies in your watchlist yet.</p>
          <p className="text-gray-400 text-sm mt-1">
            Go to <a href="/settings" className="text-blue-600 hover:underline">Settings</a> to add companies.
          </p>
        </div>
      ) : (
        <JobList
          jobs={filteredJobs}
          savedJobIds={savedJobIds}
          onSave={handleSave}
          onDismiss={handleDismiss}
          matchedKeywords={jobMatchedKeywords}
        />
      )}
    </div>
  );
}
