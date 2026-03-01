"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Job, WatchlistCompany, SearchConfig } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import ProfileSwitcher from "@/components/settings/ProfileSwitcher";
import FilterBar from "./FilterBar";
import JobList from "./JobList";

export default function JobFeed() {
  const { profiles, profileId, setProfileId, profileSlug, loading: profileLoading } = useProfile();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [watchlistCompanies, setWatchlistCompanies] = useState<WatchlistCompany[]>([]);
  const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [minSalary, setMinSalary] = useState(0);
  const [minSeniority, setMinSeniority] = useState(1);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

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
      supabase.from("jobs").select("*").gt("seniority_score", 0).order("seniority_score", { ascending: false }).order("salary_max", { ascending: false, nullsFirst: false }),
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

  // Watchlist company names (lowercased for matching)
  const watchlistNames = useMemo(
    () => new Set(watchlistCompanies.map((c) => c.name.toLowerCase())),
    [watchlistCompanies]
  );

  // Title keywords from search config (lowercased)
  const titleKeywords = useMemo(
    () => (searchConfig?.title_keywords ?? []).map((k) => k.toLowerCase()),
    [searchConfig]
  );

  // Derive unique locations and sources for filter dropdowns
  const locations = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean) as string[])).sort(),
    [jobs]
  );
  const sources = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.source).filter(Boolean) as string[])).sort(),
    [jobs]
  );

  // Client-side filtering and sorting
  const filteredJobs = useMemo(() => {
    const result = jobs.filter((job) => {
      // Filter by watchlist companies
      if (watchlistNames.size > 0 && job.company) {
        if (!watchlistNames.has(job.company.toLowerCase())) return false;
      }

      // Filter by title keywords (match any)
      if (titleKeywords.length > 0 && job.title) {
        const titleLower = job.title.toLowerCase();
        if (!titleKeywords.some((kw) => titleLower.includes(kw))) return false;
      }

      if (!showDismissed && job.is_dismissed) return false;

      // Hide score=0 always; filter by min seniority
      if ((job.seniority_score ?? 0) < minSeniority) return false;

      if (search) {
        const q = search.toLowerCase();
        const match =
          job.title?.toLowerCase().includes(q) ||
          job.company?.toLowerCase().includes(q) ||
          job.description?.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (location && job.location !== location) return false;
      if (source && job.source !== source) return false;
      if (minSalary > 0) {
        const salaryVal = job.salary_max ?? job.salary_min ?? 0;
        if (salaryVal < minSalary * 1000) return false;
      }
      if (remoteOnly && !job.is_remote) return false;

      if (dateRange && job.date_posted) {
        const daysAgo = Math.floor(
          (Date.now() - new Date(job.date_posted).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysAgo > Number(dateRange)) return false;
      }

      return true;
    });

    // Sort: seniority desc, then salary_max desc (nulls last)
    result.sort((a, b) => {
      const senDiff = (b.seniority_score ?? 0) - (a.seniority_score ?? 0);
      if (senDiff !== 0) return senDiff;
      const salA = a.salary_max ?? a.salary_min ?? 0;
      const salB = b.salary_max ?? b.salary_min ?? 0;
      return salB - salA;
    });

    return result;
  }, [jobs, watchlistNames, titleKeywords, search, location, source, dateRange, minSalary, minSeniority, remoteOnly, showDismissed]);

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
    // Optimistic update
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_dismissed: newDismissed } : j))
    );
    const supabase = createClient();
    await supabase.from("jobs").update({ is_dismissed: newDismissed }).eq("id", job.id);
  }

  if (loading || profileLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-6">
        <p className="text-gray-500 text-center py-16">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Job Feed</h1>
        <div className="flex items-center gap-3">
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={profileId}
            onSwitch={setProfileId}
          />
          <span className="text-sm text-gray-500">{filteredJobs.length} jobs</span>
        </div>
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        location={location}
        onLocationChange={setLocation}
        source={source}
        onSourceChange={setSource}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        minSalary={minSalary}
        onMinSalaryChange={setMinSalary}
        minSeniority={minSeniority}
        onMinSeniorityChange={setMinSeniority}
        remoteOnly={remoteOnly}
        onRemoteOnlyChange={setRemoteOnly}
        showDismissed={showDismissed}
        onShowDismissedChange={setShowDismissed}
        locations={locations}
        sources={sources}
      />
      <JobList
        jobs={filteredJobs}
        savedJobIds={savedJobIds}
        onSave={handleSave}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
