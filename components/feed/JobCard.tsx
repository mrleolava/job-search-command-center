"use client";

import { useState } from "react";
import { Job, WatchlistCompany } from "@/lib/types";
import { timeAgo, formatSalary, applicantColor, seniorityBadge, fundingStageBadge, growthIndicator } from "@/lib/utils";

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

function CompanyIntelBar({ co }: { co: WatchlistCompany }) {
  const [expanded, setExpanded] = useState(false);
  const stageBadge = fundingStageBadge(co.funding_stage);
  const growth = growthIndicator(co.employee_growth_6m);
  const peTarget = co.pe_revenue_exposure?.startsWith("Core") || co.pe_revenue_exposure?.startsWith("Significant");
  const hiringSpree = (co.employee_growth_6m ?? 0) > 15;

  return (
    <div className="mt-2 bg-claude-bg border border-claude-border rounded-lg px-3 py-2 text-xs">
      {/* Row 1: Stage + Raised + Employees + Growth */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-claude-secondary">
        {stageBadge && (
          <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${stageBadge.color}`}>
            {stageBadge.label}
          </span>
        )}
        <span>{co.total_raised ?? "\u2014"} raised</span>
        <span className="text-claude-border">&middot;</span>
        <span>
          {co.total_employees != null ? `${co.total_employees} employees` : "\u2014 employees"}
          {co.employee_growth_6m != null && (
            <span className={`ml-1 font-medium ${growth.color}`}>
              {growth.icon}{Math.abs(co.employee_growth_6m).toFixed(0)}%
            </span>
          )}
          {hiringSpree && " \uD83D\uDD25"}
        </span>
        {co.company_fit_score != null && co.company_fit_score > 0 && (
          <>
            <span className="text-claude-border">&middot;</span>
            <span className="font-medium text-claude-accent">Fit: {co.company_fit_score}</span>
          </>
        )}
      </div>
      {/* Row 2: PE Exposure + Investors */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-claude-secondary">
        {co.pe_revenue_exposure && (
          <span>PE: {co.pe_revenue_exposure}{peTarget ? " \uD83C\uDFAF" : ""}</span>
        )}
        {co.key_investors && (
          <>
            <span className="text-claude-border">&middot;</span>
            <span>Investors: {co.key_investors}</span>
          </>
        )}
      </div>
      {/* Row 3: Revenue + Glassdoor */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-claude-secondary">
        <span>Revenue: {co.revenue_stage ?? "\u2014"}</span>
        <span className="text-claude-border">&middot;</span>
        <span>
          Glassdoor: {co.glassdoor_rating != null ? (
            co.glassdoor_url ? (
              <a href={co.glassdoor_url} target="_blank" rel="noopener noreferrer" className="text-claude-accent hover:underline">
                {co.glassdoor_rating.toFixed(1)}{"\u2605"}
              </a>
            ) : `${co.glassdoor_rating.toFixed(1)}\u2605`
          ) : "\u2014"}
        </span>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-1 text-[10px] text-claude-tertiary hover:text-claude-secondary"
      >
        {expanded ? "Hide details" : "Company Details"}
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-claude-border grid grid-cols-2 gap-x-4 gap-y-1 text-claude-secondary">
          {co.headquarters && <div><span className="text-claude-tertiary">HQ:</span> {co.headquarters}</div>}
          {co.year_founded && <div><span className="text-claude-tertiary">Founded:</span> {co.year_founded}</div>}
          {co.ceo_name && <div><span className="text-claude-tertiary">CEO:</span> {co.ceo_name}</div>}
          {co.cro_name && <div><span className="text-claude-tertiary">CRO:</span> {co.cro_name}</div>}
          {co.last_funding_amount && <div><span className="text-claude-tertiary">Last Round:</span> {co.last_funding_amount}</div>}
          {co.last_funding_date && <div><span className="text-claude-tertiary">Funded:</span> {co.last_funding_date}</div>}
          {co.competitors && <div className="col-span-2"><span className="text-claude-tertiary">Competitors:</span> {co.competitors}</div>}
          {co.tech_stack && <div className="col-span-2"><span className="text-claude-tertiary">Tech:</span> {co.tech_stack}</div>}
          {co.recent_news && <div className="col-span-2"><span className="text-claude-tertiary">News:</span> {co.recent_news}</div>}
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
  const linkedinUrl = companyIntel?.linkedin_url;

  return (
    <div
      className={`bg-white rounded-xl border border-claude-border p-6 hover:shadow-md transition-shadow shadow-sm ${
        job.is_dismissed ? "opacity-50" : ""
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-claude-tertiary font-medium">
            {linkedinUrl ? (
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-claude-accent">
                {companyName}
              </a>
            ) : companyName}
          </div>
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
          {companyIntel && <CompanyIntelBar co={companyIntel} />}
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
