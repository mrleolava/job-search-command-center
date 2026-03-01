"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { WatchlistCompany, SearchConfig } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import ProfileSwitcher from "./ProfileSwitcher";
import CompanyWatchlist from "./CompanyWatchlist";
import TagEditor from "./TagEditor";
import ScrapeButton from "./ScrapeButton";

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

  async function updateConfigField(field: keyof SearchConfig, value: string[]) {
    if (!config) return;
    const { error } = await supabase
      .from("search_configs")
      .update({ [field]: value })
      .eq("id", config.id);
    if (!error) {
      setConfig({ ...config, [field]: value });
    }
  }

  function handleAddTag(field: "title_keywords" | "exclude_keywords" | "locations") {
    return (tag: string) => {
      if (!config) return;
      const current = config[field] ?? [];
      updateConfigField(field, [...current, tag]);
    };
  }

  function handleRemoveTag(field: "title_keywords" | "exclude_keywords" | "locations") {
    return (tag: string) => {
      if (!config) return;
      const current = config[field] ?? [];
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
            <TagEditor
              label="Title Keywords"
              tags={config.title_keywords ?? []}
              onAdd={handleAddTag("title_keywords")}
              onRemove={handleRemoveTag("title_keywords")}
            />
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
