"use client";

import { Job } from "@/lib/types";
import JobCard from "./JobCard";

interface JobListProps {
  jobs: Job[];
  savedJobIds: Set<string>;
  onSave: (job: Job) => void;
  onDismiss: (job: Job) => void;
}

export default function JobList({ jobs, savedJobIds, onSave, onDismiss }: JobListProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">No jobs match your filters.</p>
        <p className="text-gray-400 text-sm mt-1">Try adjusting your search criteria.</p>
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
        />
      ))}
    </div>
  );
}
