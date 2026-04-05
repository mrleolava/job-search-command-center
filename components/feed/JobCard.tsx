"use client";

import { useState, useRef, useEffect } from "react";
import { Job, WatchlistCompany } from "@/lib/types";
import { timeAgo, formatSalary, applicantColor, seniorityBadge, fundingStageBadge, growthIndicator } from "@/lib/utils";
import { displayLocation } from "@/lib/locations";

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => void;
  onDismiss: (job: Job) => void;
  isSaved: boolean;
  matchedKeywords?: { title: string[]; description: string[] };
  companyIntel?: WatchlistCompany | null;
}

function highlightText(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length) return text;

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

function hasIntelData(co: WatchlistCompany): boolean {
  return !!(
    co.funding_stage || co.total_raised || co.total_employees ||
    co.employee_growth_6m || co.revenue_stage || co.pe_revenue_exposure ||
    co.glassdoor_rating || co.key_investors || co.ceo_name || co.cro_name
  );
}

function CompanyTooltipContent({ co }: { co: WatchlistCompany }) {
  if (!hasIntelData(co)) {
    return (
      <div className="text-xs text-claude-tertiary py-0.5">
        No company data yet &mdash; <a href="/settings" className="text-claude-accent hover:underline">add in Settings</a>
      </div>
    );
  }

  const stageBadge = fundingStageBadge(co.funding_stage);
  const growth = growthIndicator(co.employee_growth_6m);

  return (
    <div className="text-xs space-y-1">
      {/* Row 1: Stage + Raised + Employees */}
      {(stageBadge || co.total_raised || co.total_employees != null) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-claude-secondary">
          {stageBadge && (
            <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${stageBadge.color}`}>
              {stageBadge.label}
            </span>
          )}
          {co.total_raised && (
            <>
              {stageBadge && <span className="text-claude-border">&middot;</span>}
              <span>{co.total_raised} raised</span>
            </>
          )}
          {co.total_employees != null && (
            <>
              <span className="text-claude-border">&middot;</span>
              <span>
                {co.total_employees} employees
                {co.employee_growth_6m != null && (
                  <span className={`ml-1 font-medium ${growth.color}`}>
                    {growth.icon}{Math.abs(co.employee_growth_6m).toFixed(0)}%
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      )}
      {/* Row 2: Revenue + PE */}
      {(co.revenue_stage || co.pe_revenue_exposure) && (
        <div className="flex flex-wrap items-center gap-x-1.5 text-claude-secondary">
          {co.revenue_stage && <span>Revenue: {co.revenue_stage}</span>}
          {co.revenue_stage && co.pe_revenue_exposure && <span className="text-claude-border">&middot;</span>}
          {co.pe_revenue_exposure && <span>PE: {co.pe_revenue_exposure}</span>}
        </div>
      )}
      {/* Row 3: Investors */}
      {co.key_investors && (
        <div className="text-claude-secondary">Investors: {co.key_investors}</div>
      )}
      {/* Row 4: Glassdoor */}
      {co.glassdoor_rating != null && (
        <div className="text-claude-secondary">
          Glassdoor:{" "}
          {co.glassdoor_url ? (
            <a href={co.glassdoor_url} target="_blank" rel="noopener noreferrer" className="text-claude-accent hover:underline">
              {co.glassdoor_rating.toFixed(1)}{"\u2605"}
            </a>
          ) : (
            <span>{co.glassdoor_rating.toFixed(1)}{"\u2605"}</span>
          )}
        </div>
      )}
      {/* Row 5: People */}
      {(co.ceo_name || co.cro_name) && (
        <div className="flex flex-wrap items-center gap-x-1.5 text-claude-secondary">
          {co.ceo_name && <span>CEO: {co.ceo_name}</span>}
          {co.ceo_name && co.cro_name && <span className="text-claude-border">&middot;</span>}
          {co.cro_name && <span>CRO: {co.cro_name}</span>}
        </div>
      )}
      {/* LinkedIn link */}
      {co.linkedin_url && (
        <div className="pt-0.5">
          <a href={co.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-claude-accent hover:underline text-[11px]">
            View on LinkedIn {"\u2197"}
          </a>
        </div>
      )}
    </div>
  );
}

function CompanyName({ name, intel }: { name: string; intel?: WatchlistCompany | null }) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleEnter() {
    timeoutRef.current = setTimeout(() => setShow(true), 200);
  }

  function handleLeave() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  }

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  // No tooltip for companies not on watchlist
  if (!intel) {
    return <span className="text-sm text-claude-tertiary font-medium">{name}</span>;
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <span className="text-sm text-claude-tertiary font-medium cursor-default hover:text-claude-accent hover:underline decoration-claude-border underline-offset-2 transition-colors">
        {name}
      </span>
      {show && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-claude-border rounded-xl shadow-lg p-3 min-w-[260px] max-w-[340px]">
          <div className="font-semibold text-claude-primary text-sm mb-1.5">{name}</div>
          <CompanyTooltipContent co={intel} />
        </div>
      )}
    </div>
  );
}

export default function JobCard({ job, onSave, onDismiss, isSaved, matchedKeywords, companyIntel }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const badge = seniorityBadge(job.seniority_score);
  const titleKw = matchedKeywords?.title ?? [];
  const descKw = matchedKeywords?.description ?? [];
  const companyName = job.company ?? "";

  return (
    <div
      className={`bg-white rounded-xl border border-claude-border p-6 hover:shadow-md transition-shadow shadow-sm ${
        job.is_dismissed ? "opacity-50" : ""
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <CompanyName name={companyName} intel={companyIntel} />
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
            {(job.normalized_location || job.location) && (
              <span>{displayLocation(job.normalized_location, job.location)}</span>
            )}
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
