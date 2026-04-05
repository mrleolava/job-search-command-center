"use client";

import { Job, WatchlistCompany } from "@/lib/types";
import JobCard from "./JobCard";

interface JobListProps {
  jobs: Job[];
  savedJobIds: Set<string>;
  onSave: (job: Job) => void;
  onDismiss: (job: Job) => void;
  matchedKeywords?: Map<string, { title: string[]; description: string[] }>;
  companyIntelMap?: Map<string, WatchlistCompany>;
}

export default function JobList({ jobs, savedJobIds, onSave, onDismiss, matchedKeywords, companyIntelMap }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-claude-secondary text-lg">No jobs match your filters.</p>
        <p className="text-claude-tertiary text-sm mt-1">Try adjusting your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          isSaved={savedJobIds.has(job.id)}
          onSave={onSave}
          onDismiss={onDismiss}
          matchedKeywords={matchedKeywords?.get(job.id)}
          companyIntel={job.company ? companyIntelMap?.get(job.company.toLowerCase()) ?? null : null}
        />
      ))}
    </div>
  );
}
