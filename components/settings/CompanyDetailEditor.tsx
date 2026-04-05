"use client";

import { useState, useEffect, useCallback } from "react";
import { WatchlistCompany, FUNDING_STAGES, REVENUE_STAGES, PE_EXPOSURE_OPTIONS } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { computeCompanyFitScore } from "@/lib/utils";

type SlugStatus = "idle" | "checking" | "valid" | "invalid";

interface CompanyDetailEditorProps {
  company: WatchlistCompany;
  onUpdate: (updated: WatchlistCompany) => void;
  onCancel: () => void;
}

export default function CompanyDetailEditor({ company, onUpdate, onCancel }: CompanyDetailEditorProps) {
  const [co, setCo] = useState<WatchlistCompany>(company);
  const [ghStatus, setGhStatus] = useState<SlugStatus>(company.greenhouse_slug ? "valid" : "idle");
  const [leverStatus, setLeverStatus] = useState<SlugStatus>(company.lever_slug ? "valid" : "idle");
  const [ashbyStatus, setAshbyStatus] = useState<SlugStatus>(company.ashby_slug ? "valid" : "idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => { setCo(company); }, [company]);

  const saveField = useCallback(async (field: string, value: string | number | null) => {
    const updated = { ...co, [field]: value };
    // Recompute fit score on relevant field changes
    const fitFields = ["pe_revenue_exposure", "employee_growth_6m", "glassdoor_rating", "revenue_stage", "last_funding_date", "cro_name", "key_investors"];
    if (fitFields.includes(field)) {
      updated.company_fit_score = computeCompanyFitScore(updated);
      await supabase.from("watchlist_companies").update({ [field]: value, company_fit_score: updated.company_fit_score }).eq("id", co.id);
    } else {
      await supabase.from("watchlist_companies").update({ [field]: value }).eq("id", co.id);
    }
    setCo(updated);
    onUpdate(updated);
    setLastSaved(field);
    setTimeout(() => setLastSaved(null), 1500);
  }, [co, supabase, onUpdate]);

  function field(label: string, fieldName: keyof WatchlistCompany, opts?: {
    type?: string; placeholder?: string; options?: readonly string[];
    rows?: number; min?: number; max?: number; step?: number;
  }) {
    const val = co[fieldName];
    const t = opts?.type ?? "text";

    if (opts?.options) {
      return (
        <div>
          <label className="block text-xs font-medium text-claude-secondary mb-1">
            {label} {lastSaved === fieldName && <span className="text-emerald-600 ml-1">Saved</span>}
          </label>
          <select
            value={(val as string) ?? ""}
            onChange={(e) => saveField(fieldName, e.target.value || null)}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
          >
            <option value="">—</option>
            {opts.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }

    if (t === "textarea") {
      return (
        <div>
          <label className="block text-xs font-medium text-claude-secondary mb-1">
            {label} {lastSaved === fieldName && <span className="text-emerald-600 ml-1">Saved</span>}
          </label>
          <textarea
            value={(val as string) ?? ""}
            onChange={(e) => setCo({ ...co, [fieldName]: e.target.value || null })}
            onBlur={(e) => saveField(fieldName, e.target.value || null)}
            rows={opts?.rows ?? 3}
            placeholder={opts?.placeholder}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
          />
        </div>
      );
    }

    return (
      <div>
        <label className="block text-xs font-medium text-claude-secondary mb-1">
          {label} {lastSaved === fieldName && <span className="text-emerald-600 ml-1">Saved</span>}
        </label>
        <input
          type={t}
          value={t === "number" ? ((val as number) ?? "") : ((val as string) ?? "")}
          onChange={(e) => {
            const v = t === "number" ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null);
            setCo({ ...co, [fieldName]: v });
          }}
          onBlur={(e) => {
            const v = t === "number" ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null);
            saveField(fieldName, v);
          }}
          placeholder={opts?.placeholder}
          min={opts?.min}
          max={opts?.max}
          step={opts?.step}
          className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
        />
      </div>
    );
  }

  async function verifySlug(type: "greenhouse" | "lever" | "ashby") {
    const slugMap = { greenhouse: co.greenhouse_slug, lever: co.lever_slug, ashby: co.ashby_slug };
    const setStatus = { greenhouse: setGhStatus, lever: setLeverStatus, ashby: setAshbyStatus };
    const urlMap = {
      greenhouse: (s: string) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs`,
      lever: (s: string) => `https://api.lever.co/v0/postings/${s}?mode=json&limit=1`,
      ashby: (s: string) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    };
    const slug = slugMap[type]?.trim();
    if (!slug) { setStatus[type]("idle"); return; }
    setStatus[type]("checking");
    try {
      const res = await fetch(urlMap[type](slug));
      setStatus[type](res.ok ? "valid" : "invalid");
    } catch { setStatus[type]("invalid"); }
  }

  function statusIcon(status: SlugStatus) {
    if (status === "checking") return <span className="text-claude-tertiary text-xs">...</span>;
    if (status === "valid") return <span className="text-emerald-600 text-sm">&#10003;</span>;
    if (status === "invalid") return <span className="text-red-500 text-sm">&#10007;</span>;
    return null;
  }

  const fitScore = co.company_fit_score ?? computeCompanyFitScore(co);

  return (
    <div className="bg-claude-bg border border-claude-border rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-claude-primary">{co.name}</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-claude-accent text-white">
            Fit: {fitScore}/100
          </span>
        </div>
        <button onClick={onCancel} className="text-xs text-claude-tertiary hover:text-claude-secondary">
          Done
        </button>
      </div>

      {/* BASICS */}
      <section>
        <h4 className="text-xs font-bold text-claude-tertiary uppercase tracking-wide mb-2">Basics</h4>
        <div className="grid grid-cols-2 gap-3">
          {field("Company Name", "name", { placeholder: "Company name" })}
          {field("Website", "website", { placeholder: "e.g. openai.com" })}
          {field("LinkedIn URL", "linkedin_url", { placeholder: "https://linkedin.com/company/..." })}
          {field("Headquarters", "headquarters", { placeholder: "e.g. New York, NY" })}
          {field("Year Founded", "year_founded", { type: "number", placeholder: "e.g. 2020", min: 1900, max: 2030 })}
        </div>
      </section>

      {/* SCRAPER SLUGS */}
      <section>
        <h4 className="text-xs font-bold text-claude-tertiary uppercase tracking-wide mb-2">Scraper Slugs</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-claude-secondary mb-1">
              Greenhouse {statusIcon(ghStatus)}
            </label>
            <input
              type="text"
              value={co.greenhouse_slug ?? ""}
              onChange={(e) => { setCo({ ...co, greenhouse_slug: e.target.value || null }); setGhStatus("idle"); }}
              onBlur={() => { saveField("greenhouse_slug", co.greenhouse_slug); verifySlug("greenhouse"); }}
              placeholder="e.g. openai"
              className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-claude-secondary mb-1">
              Lever {statusIcon(leverStatus)}
            </label>
            <input
              type="text"
              value={co.lever_slug ?? ""}
              onChange={(e) => { setCo({ ...co, lever_slug: e.target.value || null }); setLeverStatus("idle"); }}
              onBlur={() => { saveField("lever_slug", co.lever_slug); verifySlug("lever"); }}
              placeholder="e.g. netflix"
              className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-claude-secondary mb-1">
              Ashby {statusIcon(ashbyStatus)}
            </label>
            <input
              type="text"
              value={co.ashby_slug ?? ""}
              onChange={(e) => { setCo({ ...co, ashby_slug: e.target.value || null }); setAshbyStatus("idle"); }}
              onBlur={() => { saveField("ashby_slug", co.ashby_slug); verifySlug("ashby"); }}
              placeholder="e.g. listenlabs"
              className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
            />
          </div>
        </div>
      </section>

      {/* FUNDING & FINANCIALS */}
      <section>
        <h4 className="text-xs font-bold text-claude-tertiary uppercase tracking-wide mb-2">Funding &amp; Financials</h4>
        <div className="grid grid-cols-2 gap-3">
          {field("Funding Stage", "funding_stage", { options: FUNDING_STAGES })}
          {field("Revenue Stage", "revenue_stage", { options: REVENUE_STAGES })}
          {field("Total Raised", "total_raised", { placeholder: "e.g. $150M" })}
          {field("Last Funding Date", "last_funding_date", { type: "date" })}
          {field("Last Funding Amount", "last_funding_amount", { placeholder: "e.g. $165M Series C" })}
          {field("Key Investors", "key_investors", { placeholder: "e.g. a16z, Sequoia" })}
        </div>
      </section>

      {/* PE FIT */}
      <section>
        <h4 className="text-xs font-bold text-claude-tertiary uppercase tracking-wide mb-2">PE Fit</h4>
        <div className="grid grid-cols-2 gap-3">
          {field("PE/FinServ Revenue Exposure", "pe_revenue_exposure", { options: PE_EXPOSURE_OPTIONS })}
          {field("Competitors", "competitors", { placeholder: "e.g. Salesforce, HubSpot" })}
          {field("Tech Stack", "tech_stack", { placeholder: "e.g. React, Python, AWS" })}
        </div>
      </section>

      {/* PEOPLE */}
      <section>
        <h4 className="text-xs font-bold text-claude-tertiary uppercase tracking-wide mb-2">People</h4>
        <div className="grid grid-cols-2 gap-3">
          {field("CEO Name", "ceo_name", { placeholder: "CEO name" })}
          {field("CRO / Head of Sales", "cro_name", { placeholder: "CRO name" })}
          {field("Total Employees", "total_employees", { type: "number", placeholder: "e.g. 500", min: 0 })}
          {field("6M Employee Growth %", "employee_growth_6m", { type: "number", placeholder: "e.g. 15.5", step: 0.1 })}
          {field("Glassdoor Rating", "glassdoor_rating", { type: "number", placeholder: "e.g. 4.2", min: 0, max: 5, step: 0.1 })}
          {field("Glassdoor URL", "glassdoor_url", { placeholder: "https://glassdoor.com/..." })}
        </div>
      </section>

      {/* NOTES */}
      <section>
        <h4 className="text-xs font-bold text-claude-tertiary uppercase tracking-wide mb-2">Notes</h4>
        {field("Recent News", "recent_news", { type: "textarea", placeholder: "e.g. Just raised Series C in Jan 2026, expanding NYC office", rows: 3 })}
      </section>
    </div>
  );
}
