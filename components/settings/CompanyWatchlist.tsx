"use client";

import { useState } from "react";
import { WatchlistCompany } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import CompanyForm from "./CompanyForm";

interface CompanyWatchlistProps {
  companies: WatchlistCompany[];
  profileId: string;
  onUpdate: () => void;
}

export default function CompanyWatchlist({
  companies,
  profileId,
  onUpdate,
}: CompanyWatchlistProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const supabase = createClient();

  async function handleAdd(data: {
    name: string;
    greenhouse_slug: string | null;
    ashby_slug: string | null;
    lever_slug: string | null;
    website: string | null;
  }) {
    const { error } = await supabase.from("watchlist_companies").insert({
      ...data,
      profile_id: profileId,
    });
    if (error) {
      console.error("Failed to add company:", error);
    }
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
  ) {
    const { error } = await supabase
      .from("watchlist_companies")
      .update(data)
      .eq("id", id);
    if (error) {
      console.error("Failed to update company:", error);
    }
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

    // Also delete jobs from this company
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
        <h3 className="text-sm font-semibold text-gray-900">
          Watchlist Companies ({companies.length})
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800"
          >
            + Add Company
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-4">
          <CompanyForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      <div className="space-y-2">
        {companies.map((co) =>
          editingId === co.id ? (
            <CompanyForm
              key={co.id}
              company={co}
              onSave={(data) => handleEdit(co.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={co.id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <div>
                <span className="font-medium text-gray-900 text-sm">{co.name}</span>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
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
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                >
                  Edit
                </button>
                {deletingId === co.id ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDelete(co.id)}
                      className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeletingId(co.id)}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )
        )}
        {companies.length === 0 && (
          <p className="text-sm text-gray-500 py-4 text-center">
            No companies yet. Add one to start scraping jobs.
          </p>
        )}
      </div>
    </div>
  );
}
