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

export default function CompanyWatchlist({
  companies,
  onUpdate,
}: CompanyWatchlistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localCompanies, setLocalCompanies] = useState(companies);
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

  const companiesWithData = localCompanies.filter(hasIntelData).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-claude-primary">
            Watchlist Companies ({localCompanies.length})
          </h3>
          {localCompanies.length > 0 && (
            <span className="text-[10px] text-claude-tertiary">
              {companiesWithData}/{localCompanies.length} have data
            </span>
          )}
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover"
          >
            + Add Companies
          </button>
        )}
      </div>

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
              className="flex items-center justify-between bg-white border border-claude-border rounded-xl px-4 py-3"
            >
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
              <div className="flex gap-1">
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
