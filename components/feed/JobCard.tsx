"use client";

import { Job } from "@/lib/types";
import { timeAgo, formatSalary, applicantColor, seniorityBadge } from "@/lib/utils";

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => void;
  onDismiss: (job: Job) => void;
  isSaved: boolean;
  matchedKeywords?: { title: string[]; description: string[] };
}

function highlightText(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length) return text;

  // Build a regex that matches any keyword (case-insensitive)
  const escaped = keywords.map((kw) =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = keywords.some(
      (kw) => part.toLowerCase() === kw.toLowerCase()
    );
    if (isMatch) {
      return (
        <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export default function JobCard({ job, onSave, onDismiss, isSaved, matchedKeywords }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const badge = seniorityBadge(job.seniority_score);
  const titleKw = matchedKeywords?.title ?? [];
  const descKw = matchedKeywords?.description ?? [];

  return (
    <div
      className={`bg-white rounded-xl border border-claude-border p-6 hover:shadow-md transition-shadow shadow-sm ${
        job.is_dismissed ? "opacity-50" : ""
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-claude-tertiary font-medium">{job.company}</div>
          <h3 className="font-semibold text-claude-primary mt-0.5">
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {titleKw.length > 0
                  ? highlightText(job.title ?? "", titleKw)
                  : job.title}
              </a>
            ) : titleKw.length > 0 ? (
              highlightText(job.title ?? "", titleKw)
            ) : (
              job.title
            )}
          </h3>
          <div className="flex flex-wrap gap-2 mt-2 text-sm text-claude-tertiary">
            {job.location && <span>{job.location}</span>}
            <span className="text-claude-border">&middot;</span>
            <span className={job.salary_min || job.salary_max ? "text-emerald-700 font-medium" : "text-claude-tertiary"}>
              {salary}
            </span>
            {job.application_count != null && (
              <>
                <span className="text-claude-border">&middot;</span>
                <span className={applicantColor(job.application_count)}>
                  {job.application_count} applicants
                </span>
              </>
            )}
            {job.date_posted && (
              <>
                <span className="text-claude-border">&middot;</span>
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
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-claude-accent-light text-claude-accent">
                {job.source}
              </span>
            )}
            {job.is_remote && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                Remote
              </span>
            )}
            {job.job_type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-claude-hover text-claude-secondary">
                {job.job_type}
              </span>
            )}
            {descKw.length > 0 && (
              descKw.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                >
                  {kw}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onSave(job)}
            disabled={isSaved}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isSaved
                ? "bg-claude-hover text-claude-tertiary cursor-not-allowed"
                : "bg-claude-accent text-white hover:bg-claude-accent-hover"
            }`}
          >
            {isSaved ? "Saved" : "Save"}
          </button>
          <button
            onClick={() => onDismiss(job)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-claude-border text-claude-secondary hover:bg-claude-hover transition-colors"
          >
            {job.is_dismissed ? "Restore" : "Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}
