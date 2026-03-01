"use client";

import { Job } from "@/lib/types";
import { timeAgo, formatSalary, applicantColor, seniorityBadge } from "@/lib/utils";

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => void;
  onDismiss: (job: Job) => void;
  isSaved: boolean;
}

export default function JobCard({ job, onSave, onDismiss, isSaved }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const badge = seniorityBadge(job.seniority_score);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
        job.is_dismissed ? "opacity-50" : ""
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-500 font-medium">{job.company}</div>
          <h3 className="font-semibold text-gray-900 mt-0.5">
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {job.title}
              </a>
            ) : (
              job.title
            )}
          </h3>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-500">
            {job.location && <span>{job.location}</span>}
            <span className="text-gray-300">·</span>
            <span className={job.salary_min || job.salary_max ? "text-green-700 font-medium" : "text-gray-400"}>
              {salary}
            </span>
            {job.application_count != null && (
              <>
                <span className="text-gray-300">·</span>
                <span className={applicantColor(job.application_count)}>
                  {job.application_count} applicants
                </span>
              </>
            )}
            {job.date_posted && (
              <>
                <span className="text-gray-300">·</span>
                <span>{timeAgo(job.date_posted)}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {badge && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                {badge.label}
              </span>
            )}
            {job.source && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {job.source}
              </span>
            )}
            {job.is_remote && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Remote
              </span>
            )}
            {job.job_type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                {job.job_type}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onSave(job)}
            disabled={isSaved}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isSaved
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-gray-900 text-white hover:bg-gray-700"
            }`}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
          <button
            onClick={() => onDismiss(job)}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {job.is_dismissed ? "Restore" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
