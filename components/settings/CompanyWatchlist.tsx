"use client";

import { useState } from "react";
import { WatchlistCompany } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import CompanyForm from "./CompanyForm";
import BulkAddForm from "./BulkAddForm";

interface CompanyWatchlistProps {
  companies: WatchlistCompany[];
  onUpdate: () => void;
}

export default function CompanyWatchlist({
  companies,
  onUpdate,
}: CompanyWatchlistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  function handleAddComplete() {
    setShowAddForm(false);
    onUpdate();
  }

  async function handleEdit(
    id: string,
    data: {
      name: string;
      greenhouse_slug: string | null;
      ashby_slug: string | null;
      lever_slug: string | null;
      website: string | null;
    }
  ): Promise<string | null> {
    const { error } = await supabase
      .from("watchlist_companies")
      .update(data)
      .eq("id", id);
    if (error) {
      console.error("Failed to update company:", error);
      return null;
    }
    return id;
  }

  function handleEditComplete() {
    setEditingId(null);
    onUpdate();
  }

  async function handleDelete(id: string) {
    const company = companies.find((c) => c.id === id);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-claude-primary">
          Watchlist Companies ({companies.length})
        </h3>
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
            existingCompanies={companies}
            onComplete={handleAddComplete}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      <div className="space-y-2">
        {companies.map((co) =>
          editingId === co.id ? (
            <CompanyForm
              key={co.id}
              company={co}
              onSave={(data) => handleEdit(co.id, data)}
              onComplete={handleEditComplete}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={co.id}
              className="flex items-center justify-between bg-white border border-claude-border rounded-xl px-4 py-3"
            >
              <div>
                <span className="font-medium text-claude-primary text-sm">{co.name}</span>
                <div className="flex gap-3 mt-0.5 text-xs text-claude-tertiary">
                  {co.greenhouse_slug && <span>greenhouse: {co.greenhouse_slug}</span>}
                  {co.lever_slug && <span>lever: {co.lever_slug}</span>}
                  {co.ashby_slug && <span>ashby: {co.ashby_slug}</span>}
                  {co.website && <span>{co.website}</span>}
                  {!co.greenhouse_slug && !co.ashby_slug && !co.lever_slug && (
                    <span className="text-amber-600">No scraper slug</span>
                  )}
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
        {companies.length === 0 && (
          <p className="text-sm text-claude-tertiary py-4 text-center">
            No companies yet. Add one to start scraping jobs.
          </p>
        )}
      </div>
    </div>
  );
}
