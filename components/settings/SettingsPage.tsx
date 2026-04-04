"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { WatchlistCompany, SearchConfig, MatchMode } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import ProfileSwitcher from "./ProfileSwitcher";
import CompanyWatchlist from "./CompanyWatchlist";
import TagEditor from "./TagEditor";
import ScrapeButton from "./ScrapeButton";

function MatchModeToggle({
  mode,
  onChange,
}: {
  mode: MatchMode;
  onChange: (mode: MatchMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => onChange("OR")}
        className={`px-2 py-0.5 rounded-l-md border transition-colors ${
          mode === "OR"
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Match ANY
      </button>
      <button
        type="button"
        onClick={() => onChange("AND")}
        className={`px-2 py-0.5 rounded-r-md border border-l-0 transition-colors ${
          mode === "AND"
            ? "bg-gray-900 text-white border-gray-900"
            : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
        }`}
      >
        Match ALL
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const { profiles, profileId, setProfileId, loading } = useProfile();
  const [companies, setCompanies] = useState<WatchlistCompany[]>([]);
  const [config, setConfig] = useState<SearchConfig | null>(null);

  const fetchData = useCallback(async () => {
    if (!profileId) return;

    const [compRes, cfgRes] = await Promise.all([
      supabase
        .from("watchlist_companies")
        .select("*")
        .eq("profile_id", profileId)
        .order("name"),
      supabase
        .from("search_configs")
        .select("*")
        .eq("profile_id", profileId)
        .limit(1),
    ]);

    setCompanies(compRes.data ?? []);
    setConfig(cfgRes.data?.[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function updateConfigField(field: string, value: string[] | string) {
    if (!config) return;
    const { error } = await supabase
      .from("search_configs")
      .update({ [field]: value })
      .eq("id", config.id);
    if (!error) {
      setConfig({ ...config, [field]: value } as SearchConfig);
    }
  }

  function handleAddTag(field: "title_keywords" | "exclude_keywords" | "locations" | "description_keywords") {
    return (tag: string) => {
      if (!config) return;
      const current = (config[field] as string[]) ?? [];
      updateConfigField(field, [...current, tag]);
    };
  }

  function handleRemoveTag(field: "title_keywords" | "exclude_keywords" | "locations" | "description_keywords") {
    return (tag: string) => {
      if (!config) return;
      const current = (config[field] as string[]) ?? [];
      updateConfigField(field, current.filter((t) => t !== tag));
    };
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-6 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <ProfileSwitcher
          profiles={profiles}
          activeProfileId={profileId}
          onSwitch={setProfileId}
        />
      </div>

      {/* Search Config */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Configuration</h2>
        {config ? (
          <div className="space-y-5">
            {/* Title Keywords */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Title Keywords</label>
                <MatchModeToggle
                  mode={config.title_match_mode ?? "OR"}
                  onChange={(mode) => updateConfigField("title_match_mode", mode)}
                />
              </div>
              <p className="text-xs text-gray-400 mb-2">
                {(config.title_match_mode ?? "OR") === "OR"
                  ? "Jobs where title contains ANY of these keywords"
                  : "Jobs where title contains ALL of these keywords"}
              </p>
              <TagEditor
                label=""
                tags={config.title_keywords ?? []}
                onAdd={handleAddTag("title_keywords")}
                onRemove={handleRemoveTag("title_keywords")}
              />
            </div>

            {/* Description Keywords */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Description Keywords</label>
                <MatchModeToggle
                  mode={config.description_match_mode ?? "OR"}
                  onChange={(mode) => updateConfigField("description_match_mode", mode)}
                />
              </div>
              <p className="text-xs text-gray-400 mb-2">
                {(config.description_match_mode ?? "OR") === "OR"
                  ? "Jobs where description contains ANY of these keywords"
                  : "Jobs where description contains ALL of these keywords"}
              </p>
              <TagEditor
                label=""
                tags={config.description_keywords ?? []}
                onAdd={handleAddTag("description_keywords")}
                onRemove={handleRemoveTag("description_keywords")}
              />
            </div>

            {/* Combine Mode */}
            {((config.title_keywords?.length ?? 0) > 0 || (config.description_keywords?.length ?? 0) > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Combine Mode</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(config.cross_match_mode ?? "AND") === "AND"
                        ? "Title must match AND description must match"
                        : "Title matches OR description matches"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => updateConfigField("cross_match_mode", "AND")}
                      className={`px-2 py-0.5 rounded-l-md border transition-colors ${
                        (config.cross_match_mode ?? "AND") === "AND"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfigField("cross_match_mode", "OR")}
                      className={`px-2 py-0.5 rounded-r-md border border-l-0 transition-colors ${
                        (config.cross_match_mode ?? "AND") === "OR"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      OR
                    </button>
                  </div>
                </div>
              </div>
            )}

            <TagEditor
              label="Exclude Keywords"
              tags={config.exclude_keywords ?? []}
              onAdd={handleAddTag("exclude_keywords")}
              onRemove={handleRemoveTag("exclude_keywords")}
            />
            <TagEditor
              label="Locations"
              tags={config.locations ?? []}
              onAdd={handleAddTag("locations")}
              onRemove={handleRemoveTag("locations")}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">No search config found for this profile.</p>
        )}
      </section>

      {/* Company Watchlist */}
      <section className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Watchlist</h2>
        <CompanyWatchlist
          companies={companies}
          profileId={profileId}
          onUpdate={fetchData}
        />
      </section>

      {/* Scraper */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Scraper</h2>
        <ScrapeButton profileId={profileId} />
      </section>
    </div>
  );
}
