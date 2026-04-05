"use client";

import { useState } from "react";
import { WatchlistCompany } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { fundingStageBadge } from "@/lib/utils";
import CompanyDetailEditor from "./CompanyDetailEditor";
import BulkAddForm from "./BulkAddForm";

interface CompanyWatchlistProps {
  companies: WatchlistCompany[];
  onUpdate: () => void;
}

function hasIntelData(co: WatchlistCompany): boolean {
  return !!(
    co.funding_stage || co.total_raised || co.total_employees ||
    co.employee_growth_6m || co.revenue_stage || co.pe_revenue_exposure ||
    co.glassdoor_rating || co.key_investors || co.ceo_name || co.cro_name
  );
}

async function enrichCompany(companyId: string): Promise<{
  foundFields: string[];
  missing: string[];
} | null> {
  try {
    const res = await fetch("/api/enrich-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function CompanyWatchlist({
  companies,
  onUpdate,
}: CompanyWatchlistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localCompanies, setLocalCompanies] = useState(companies);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichAllRunning, setEnrichAllRunning] = useState(false);
  const [enrichAllProgress, setEnrichAllProgress] = useState({ current: 0, total: 0 });
  const [enrichAllSummary, setEnrichAllSummary] = useState<{ updated: number; noData: number } | null>(null);
  const supabase = createClient();

  // Keep local state in sync with props
  if (companies !== localCompanies && !editingId) {
    setLocalCompanies(companies);
  }

  function handleAddComplete() {
    setShowAddForm(false);
    onUpdate();
  }

  function handleDetailUpdate(updated: WatchlistCompany) {
    setLocalCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleEditDone() {
    setEditingId(null);
    onUpdate();
  }

  async function handleDelete(id: string) {
    const company = localCompanies.find((c) => c.id === id);

    const { error } = await supabase
      .from("watchlist_companies")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Failed to delete company:", error);
      return;
    }

    if (company) {
      const { error: jobsError } = await supabase
        .from("jobs")
        .delete()
        .ilike("company", company.name);
      if (jobsError) {
        console.error("Failed to delete jobs for company:", jobsError);
      }
    }

    setDeletingId(null);
    onUpdate();
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setLocalCompanies((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: isActive } : c))
    );
    await supabase
      .from("watchlist_companies")
      .update({ is_active: isActive })
      .eq("id", id);
  }

  async function handleEnrichOne(companyId: string) {
    setEnrichingId(companyId);
    await enrichCompany(companyId);
    setEnrichingId(null);
    onUpdate();
  }

  async function handleEnrichAll() {
    const toEnrich = localCompanies.filter((co) => !hasIntelData(co) || co.last_enriched_at == null);
    if (toEnrich.length === 0) {
      // Enrich all companies regardless
      const all = localCompanies;
      setEnrichAllRunning(true);
      setEnrichAllSummary(null);
      setEnrichAllProgress({ current: 0, total: all.length });

      let updated = 0;
      let noData = 0;

      for (let i = 0; i < all.length; i++) {
        setEnrichAllProgress({ current: i + 1, total: all.length });
        const result = await enrichCompany(all[i].id);
        if (result && result.foundFields.length > 0) updated++;
        else noData++;
        // 2-second delay between companies
        if (i < all.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      setEnrichAllRunning(false);
      setEnrichAllSummary({ updated, noData });
      onUpdate();
      return;
    }

    setEnrichAllRunning(true);
    setEnrichAllSummary(null);
    setEnrichAllProgress({ current: 0, total: toEnrich.length });

    let updated = 0;
    let noData = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      setEnrichAllProgress({ current: i + 1, total: toEnrich.length });
      const result = await enrichCompany(toEnrich[i].id);
      if (result && result.foundFields.length > 0) updated++;
      else noData++;
      // 2-second delay between companies
      if (i < toEnrich.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    setEnrichAllRunning(false);
    setEnrichAllSummary({ updated, noData });
    onUpdate();
  }

  const companiesWithData = localCompanies.filter(hasIntelData).length;
  const activeCount = localCompanies.filter((c) => c.is_active).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-claude-primary">
            Watchlist Companies ({activeCount} active / {localCompanies.length} total)
          </h3>
          {localCompanies.length > 0 && (
            <span className="text-[10px] text-claude-tertiary">
              {companiesWithData}/{localCompanies.length} have data
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {localCompanies.length > 0 && !enrichAllRunning && (
            <button
              onClick={handleEnrichAll}
              className="px-3 py-1.5 text-sm rounded-lg border border-claude-border text-claude-secondary hover:bg-claude-hover"
            >
              Enrich All
            </button>
          )}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover"
            >
              + Add Companies
            </button>
          )}
        </div>
      </div>

      {/* Enrich All progress */}
      {enrichAllRunning && (
        <div className="flex items-center gap-2 text-sm text-claude-secondary mb-3 bg-claude-hover rounded-lg px-3 py-2">
          <svg className="animate-spin h-4 w-4 text-claude-accent shrink-0" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Enriching {enrichAllProgress.current} of {enrichAllProgress.total}...
        </div>
      )}

      {/* Enrich All summary */}
      {enrichAllSummary && !enrichAllRunning && (
        <div className="text-sm mb-3 bg-claude-hover rounded-lg px-3 py-2 flex items-center justify-between">
          <span>
            <span className="text-emerald-700 font-medium">Updated {enrichAllSummary.updated} companies.</span>
            {enrichAllSummary.noData > 0 && (
              <span className="text-claude-tertiary ml-1">
                {enrichAllSummary.noData} had no data available.
              </span>
            )}
          </span>
          <button
            onClick={() => setEnrichAllSummary(null)}
            className="text-xs text-claude-tertiary hover:text-claude-secondary"
          >
            &times;
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="mb-4">
          <BulkAddForm
            existingCompanies={localCompanies}
            onComplete={handleAddComplete}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {localCompanies.map((co) =>
          editingId === co.id ? (
            <CompanyDetailEditor
              key={co.id}
              company={co}
              onUpdate={handleDetailUpdate}
              onCancel={handleEditDone}
            />
          ) : (
            <div
              key={co.id}
              className={`flex items-center justify-between bg-white border border-claude-border rounded-xl px-4 py-3 transition-opacity ${
                co.is_active ? "" : "opacity-50"
              }`}
            >
              {/* Toggle switch */}
              <button
                onClick={() => handleToggleActive(co.id, !co.is_active)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mr-3 ${
                  co.is_active ? "bg-emerald-500" : "bg-claude-border"
                }`}
                title={co.is_active ? "Active — click to pause" : "Paused — click to activate"}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                    co.is_active ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-claude-primary text-sm">{co.name}</span>
                  {fundingStageBadge(co.funding_stage) && (
                    <span className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium ${fundingStageBadge(co.funding_stage)!.color}`}>
                      {fundingStageBadge(co.funding_stage)!.label}
                    </span>
                  )}
                  {co.total_employees != null && (
                    <span className="text-[10px] text-claude-tertiary">
                      {co.total_employees} emp
                    </span>
                  )}
                  {co.company_fit_score != null && co.company_fit_score > 0 && (
                    <span className="text-[10px] font-medium text-claude-accent">
                      Fit: {co.company_fit_score}
                    </span>
                  )}
                  {!hasIntelData(co) && (
                    <span className="text-[10px] text-amber-500">
                      {"\u26A0"} No data
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-claude-tertiary">
                  {co.greenhouse_slug && <span>greenhouse: {co.greenhouse_slug}</span>}
                  {co.lever_slug && <span>lever: {co.lever_slug}</span>}
                  {co.ashby_slug && <span>ashby: {co.ashby_slug}</span>}
                  {!co.greenhouse_slug && !co.ashby_slug && !co.lever_slug && (
                    <span className="text-amber-600">No scraper slug</span>
                  )}
                  {co.revenue_stage && <span>{co.revenue_stage}</span>}
                  {co.pe_revenue_exposure && <span>PE: {co.pe_revenue_exposure.split(" ")[0]}</span>}
                </div>
              </div>
              <div className="flex gap-1 items-center">
                {/* Re-enrich button */}
                <button
                  onClick={() => handleEnrichOne(co.id)}
                  disabled={enrichingId === co.id || enrichAllRunning}
                  title="Re-enrich company data"
                  className="px-1.5 py-1 text-claude-tertiary hover:text-claude-accent hover:bg-claude-hover rounded-lg disabled:opacity-40 transition-colors"
                >
                  {enrichingId === co.id ? (
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setEditingId(co.id)}
                  className="px-2 py-1 text-xs text-claude-secondary hover:bg-claude-hover rounded-lg"
                >
                  Edit
                </button>
                {deletingId === co.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(co.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-2 py-1 text-xs text-claude-secondary hover:bg-claude-hover rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(co.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        )}
        {localCompanies.length === 0 && (
          <p className="text-sm text-claude-tertiary py-4 text-center">
            No companies yet. Add one to start scraping jobs.
          </p>
        )}
      </div>
    </div>
  );
}
