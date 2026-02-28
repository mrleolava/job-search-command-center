"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Job } from "@/lib/types";
import FilterBar from "./FilterBar";
import JobList from "./JobList";

export default function JobFeed() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const supabase = createClient();
    const [jobsRes, appsRes] = await Promise.all([
      supabase.from("jobs").select("*").order("date_posted", { ascending: false }),
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

  // Derive unique locations and sources for filter dropdowns
  const locations = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean) as string[])).sort(),
    [jobs]
  );
  const sources = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.source).filter(Boolean) as string[])).sort(),
    [jobs]
  );

  // Client-side filtering
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (!showDismissed && job.is_dismissed) return false;

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
      if (remoteOnly && !job.is_remote) return false;

      if (dateRange && job.date_posted) {
        const daysAgo = Math.floor(
          (Date.now() - new Date(job.date_posted).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysAgo > Number(dateRange)) return false;
      }

      return true;
    });
  }, [jobs, search, location, source, dateRange, remoteOnly, showDismissed]);

  async function handleSave(job: Job) {
    const supabase = createClient();
    const { error } = await supabase
      .from("applications")
      .insert({ job_id: job.id, stage: "saved", profile: "michael" });
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

  if (loading) {
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
        <span className="text-sm text-gray-500">{filteredJobs.length} jobs</span>
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
