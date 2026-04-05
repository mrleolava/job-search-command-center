"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { WatchlistCompany, SearchConfig, MatchMode, KeywordBankEntry, KeywordPreset } from "@/lib/types";
import { PROFILE_ID } from "@/lib/profile";
import CompanyWatchlist from "./CompanyWatchlist";
import TagEditor from "./TagEditor";
import KeywordPresets from "./KeywordPresets";
import ScrapeButton from "./ScrapeButton";

function MatchModeToggle({
  mode,
  onChange,
  label,
}: {
  mode: MatchMode;
  onChange: (mode: MatchMode) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <button
        type="button"
        onClick={() => {
          console.log(`[MatchModeToggle:${label}] Clicked OR, current mode:`, mode);
          onChange("OR");
        }}
        className={`px-2 py-0.5 rounded-l-lg border transition-colors ${
          mode === "OR"
            ? "bg-claude-accent text-white border-claude-accent"
            : "bg-white text-claude-tertiary border-claude-border hover:bg-claude-hover"
        }`}
      >
        Match ANY
      </button>
      <button
        type="button"
        onClick={() => {
          console.log(`[MatchModeToggle:${label}] Clicked AND, current mode:`, mode);
          onChange("AND");
        }}
        className={`px-2 py-0.5 rounded-r-lg border border-l-0 transition-colors ${
          mode === "AND"
            ? "bg-claude-accent text-white border-claude-accent"
            : "bg-white text-claude-tertiary border-claude-border hover:bg-claude-hover"
        }`}
      >
        Match ALL
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const [companies, setCompanies] = useState<WatchlistCompany[]>([]);
  const [config, setConfig] = useState<SearchConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ field: string; ok: boolean; msg: string } | null>(null);
  const [bankKeywords, setBankKeywords] = useState<KeywordBankEntry[]>([]);
  const [presets, setPresets] = useState<KeywordPreset[]>([]);
  const [bankSeeded, setBankSeeded] = useState(false);

  const fetchData = useCallback(async () => {
    const [compRes, cfgRes, bankRes, presetRes] = await Promise.all([
      supabase
        .from("watchlist_companies")
        .select("*")
        .eq("profile_id", PROFILE_ID)
        .order("name"),
      supabase
        .from("search_configs")
        .select("*")
        .eq("profile_id", PROFILE_ID)
        .limit(1),
      supabase
        .from("keyword_bank")
        .select("*")
        .order("keyword"),
      supabase
        .from("keyword_presets")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    setCompanies(compRes.data ?? []);
    const loadedConfig = cfgRes.data?.[0] ?? null;
    setConfig(loadedConfig);
    setBankKeywords(bankRes.data ?? []);
    setPresets(presetRes.data ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Seed bank with existing config keywords on first load
  useEffect(() => {
    if (bankSeeded || !config || bankKeywords.length > 0) return;
    setBankSeeded(true);

    const toSeed: { keyword: string; keyword_type: string }[] = [];
    for (const kw of config.title_keywords ?? []) {
      toSeed.push({ keyword: kw, keyword_type: "title" });
    }
    for (const kw of config.description_keywords ?? []) {
      toSeed.push({ keyword: kw, keyword_type: "description" });
    }
    for (const kw of config.exclude_keywords ?? []) {
      toSeed.push({ keyword: kw, keyword_type: "exclude" });
    }

    if (toSeed.length > 0) {
      supabase
        .from("keyword_bank")
        .upsert(toSeed, { onConflict: "keyword,keyword_type", ignoreDuplicates: true })
        .then(({ data }) => {
          if (data) setBankKeywords(data);
          else fetchData();
        });
    }
  }, [config, bankKeywords, bankSeeded, supabase, fetchData]);

  async function updateConfigField(field: string, value: string[] | string | boolean) {
    if (!config) return;

    const prevConfig = config;
    setConfig({ ...config, [field]: value } as SearchConfig);

    const { data, error } = await supabase
      .from("search_configs")
      .update({ [field]: value })
      .eq("id", config.id)
      .select();

    if (error) {
      setConfig(prevConfig);
      setSaveStatus({ field, ok: false, msg: `Failed: ${error.message}` });
    } else {
      console.log(`[settings] Updated ${field}`, data?.[0]?.[field]);
      setSaveStatus({ field, ok: true, msg: `Saved ${field}` });
    }

    setTimeout(() => setSaveStatus(null), 3000);
  }

  async function saveToBank(keyword: string, keywordType: "title" | "description" | "exclude") {
    // Optimistic: add locally if not already present
    const exists = bankKeywords.some(
      (b) => b.keyword.toLowerCase() === keyword.toLowerCase() && b.keyword_type === keywordType
    );
    if (!exists) {
      const optimistic: KeywordBankEntry = {
        id: crypto.randomUUID(),
        keyword,
        keyword_type: keywordType,
        created_at: new Date().toISOString(),
      };
      setBankKeywords((prev) => [...prev, optimistic]);
    }

    await supabase
      .from("keyword_bank")
      .upsert(
        { keyword, keyword_type: keywordType },
        { onConflict: "keyword,keyword_type", ignoreDuplicates: true }
      );
  }

  function handleAddTag(field: "title_keywords" | "exclude_keywords" | "locations" | "description_keywords") {
    const typeMap: Record<string, "title" | "description" | "exclude"> = {
      title_keywords: "title",
      description_keywords: "description",
      exclude_keywords: "exclude",
    };
    return (tag: string) => {
      if (!config) return;
      const current = (config[field] as string[]) ?? [];
      updateConfigField(field, [...current, tag]);
      // Also save to bank (not for locations)
      if (typeMap[field]) {
        saveToBank(tag, typeMap[field]);
      }
    };
  }

  function handleRemoveTag(field: "title_keywords" | "exclude_keywords" | "locations" | "description_keywords") {
    return (tag: string) => {
      if (!config) return;
      const current = (config[field] as string[]) ?? [];
      updateConfigField(field, current.filter((t) => t !== tag));
      // Keyword stays in bank — no deletion
    };
  }

  function handleBankClick(
    field: "title_keywords" | "description_keywords" | "exclude_keywords",
    keyword: string
  ) {
    if (!config) return;
    const current = (config[field] as string[]) ?? [];
    if (!current.some((k) => k.toLowerCase() === keyword.toLowerCase())) {
      updateConfigField(field, [...current, keyword]);
    }
  }

  async function handleLoadPreset(preset: KeywordPreset) {
    if (!config) return;

    // Save all preset keywords to bank
    const toSeed: { keyword: string; keyword_type: string }[] = [];
    for (const kw of preset.title_keywords) toSeed.push({ keyword: kw, keyword_type: "title" });
    for (const kw of preset.description_keywords) toSeed.push({ keyword: kw, keyword_type: "description" });
    for (const kw of preset.exclude_keywords) toSeed.push({ keyword: kw, keyword_type: "exclude" });
    if (toSeed.length > 0) {
      supabase
        .from("keyword_bank")
        .upsert(toSeed, { onConflict: "keyword,keyword_type", ignoreDuplicates: true })
        .then(() => fetchData());
    }

    // Update config with all three keyword fields
    const prevConfig = config;
    const newConfig = {
      ...config,
      title_keywords: preset.title_keywords,
      description_keywords: preset.description_keywords,
      exclude_keywords: preset.exclude_keywords,
    };
    setConfig(newConfig);

    const { error } = await supabase
      .from("search_configs")
      .update({
        title_keywords: preset.title_keywords,
        description_keywords: preset.description_keywords,
        exclude_keywords: preset.exclude_keywords,
      })
      .eq("id", config.id);

    if (error) {
      setConfig(prevConfig);
      setSaveStatus({ field: "preset", ok: false, msg: `Failed to load preset` });
    } else {
      setSaveStatus({ field: "preset", ok: true, msg: `Loaded preset "${preset.name}"` });
    }
    setTimeout(() => setSaveStatus(null), 3000);
  }

  async function handleSavePreset(name: string) {
    if (!config) return;
    const { error } = await supabase.from("keyword_presets").insert({
      name,
      title_keywords: config.title_keywords ?? [],
      description_keywords: config.description_keywords ?? [],
      exclude_keywords: config.exclude_keywords ?? [],
    });
    if (error) {
      setSaveStatus({ field: "preset", ok: false, msg: `Failed to save preset` });
    } else {
      setSaveStatus({ field: "preset", ok: true, msg: `Saved preset "${name}"` });
      fetchData();
    }
    setTimeout(() => setSaveStatus(null), 3000);
  }

  async function handleDeletePreset(id: string) {
    await supabase.from("keyword_presets").delete().eq("id", id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function bankKeywordsForType(type: "title" | "description" | "exclude"): string[] {
    return bankKeywords
      .filter((b) => b.keyword_type === type)
      .map((b) => b.keyword);
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-6 text-center text-claude-tertiary">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <h1 className="text-2xl font-bold text-claude-primary mb-6">Settings</h1>

      {/* Save status toast */}
      {saveStatus && (
        <div className={`mb-4 px-3 py-2 rounded-xl text-xs font-medium ${
          saveStatus.ok
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {saveStatus.ok ? "\u2713" : "\u2717"} {saveStatus.msg}
        </div>
      )}

      {/* Search Mode Toggle */}
      {config && (
        <section className="bg-white border border-claude-border rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-claude-primary">Search Mode</h2>
              <p className="text-sm text-claude-tertiary mt-0.5">
                {(config.company_search_enabled ?? true)
                  ? "Scraping jobs from your watchlist companies via their career pages"
                  : "Searching Indeed, LinkedIn & ZipRecruiter using your keywords"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateConfigField("company_search_enabled", !(config.company_search_enabled ?? true))}
              className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                (config.company_search_enabled ?? true) ? "bg-claude-accent" : "bg-claude-tertiary"
              }`}
            >
              <span className="sr-only">Company Search</span>
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform ${
                  (config.company_search_enabled ?? true) ? "translate-x-[25px]" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              (config.company_search_enabled ?? true)
                ? "bg-claude-accent-light text-claude-accent"
                : "bg-violet-100 text-violet-700"
            }`}>
              {(config.company_search_enabled ?? true) ? "Company Search" : "Keyword Search"}
            </span>
          </div>
        </section>
      )}

      {/* Search Config */}
      <section className="bg-white border border-claude-border rounded-xl p-6 mb-6 shadow-sm">
        <h2 className="text-lg font-semibold text-claude-primary mb-4">Search Configuration</h2>
        {config ? (
          <div className="space-y-5">
            {/* Presets */}
            <KeywordPresets
              presets={presets}
              onLoad={handleLoadPreset}
              onSave={handleSavePreset}
              onDelete={handleDeletePreset}
            />

            {/* Title Keywords */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-claude-secondary">Title Keywords</label>
                <MatchModeToggle
                  label="title"
                  mode={config.title_match_mode ?? "OR"}
                  onChange={(mode) => updateConfigField("title_match_mode", mode)}
                />
              </div>
              <p className="text-xs text-claude-tertiary mb-2">
                {(config.title_match_mode ?? "OR") === "OR"
                  ? "Jobs where title contains ANY of these keywords"
                  : "Jobs where title contains ALL of these keywords"}
              </p>
              <TagEditor
                label=""
                tags={config.title_keywords ?? []}
                onAdd={handleAddTag("title_keywords")}
                onRemove={handleRemoveTag("title_keywords")}
                bankKeywords={bankKeywordsForType("title")}
                onBankClick={(kw) => handleBankClick("title_keywords", kw)}
                onSaveToBank={(kw) => saveToBank(kw, "title")}
              />
            </div>

            {/* Description Keywords */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-claude-secondary">Description Keywords</label>
                <MatchModeToggle
                  label="description"
                  mode={config.description_match_mode ?? "OR"}
                  onChange={(mode) => updateConfigField("description_match_mode", mode)}
                />
              </div>
              <p className="text-xs text-claude-tertiary mb-2">
                {(config.description_match_mode ?? "OR") === "OR"
                  ? "Jobs where description contains ANY of these keywords"
                  : "Jobs where description contains ALL of these keywords"}
              </p>
              <TagEditor
                label=""
                tags={config.description_keywords ?? []}
                onAdd={handleAddTag("description_keywords")}
                onRemove={handleRemoveTag("description_keywords")}
                bankKeywords={bankKeywordsForType("description")}
                onBankClick={(kw) => handleBankClick("description_keywords", kw)}
                onSaveToBank={(kw) => saveToBank(kw, "description")}
              />
            </div>

            {/* Combine Mode */}
            {((config.title_keywords?.length ?? 0) > 0 || (config.description_keywords?.length ?? 0) > 0) && (
              <div className="bg-claude-bg border border-claude-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-claude-secondary">Combine Mode</span>
                    <p className="text-xs text-claude-tertiary mt-0.5">
                      {(config.cross_match_mode ?? "AND") === "AND"
                        ? "Title must match AND description must match"
                        : "Title matches OR description matches"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => updateConfigField("cross_match_mode", "AND")}
                      className={`px-2 py-0.5 rounded-l-lg border transition-colors ${
                        (config.cross_match_mode ?? "AND") === "AND"
                          ? "bg-claude-accent text-white border-claude-accent"
                          : "bg-white text-claude-tertiary border-claude-border hover:bg-claude-hover"
                      }`}
                    >
                      AND
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfigField("cross_match_mode", "OR")}
                      className={`px-2 py-0.5 rounded-r-lg border border-l-0 transition-colors ${
                        (config.cross_match_mode ?? "AND") === "OR"
                          ? "bg-claude-accent text-white border-claude-accent"
                          : "bg-white text-claude-tertiary border-claude-border hover:bg-claude-hover"
                      }`}
                    >
                      OR
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Exclude Keywords */}
            <TagEditor
              label="Exclude Keywords"
              tags={config.exclude_keywords ?? []}
              onAdd={handleAddTag("exclude_keywords")}
              onRemove={handleRemoveTag("exclude_keywords")}
              bankKeywords={bankKeywordsForType("exclude")}
              onBankClick={(kw) => handleBankClick("exclude_keywords", kw)}
              onSaveToBank={(kw) => saveToBank(kw, "exclude")}
            />

            {/* Geography Filter */}
            <div>
              <label className="text-sm font-medium text-claude-secondary block mb-1.5">Geography</label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm text-claude-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.include_remote ?? true}
                    onChange={(e) => updateConfigField("include_remote", e.target.checked)}
                    className="rounded accent-claude-accent"
                  />
                  Remote
                </label>
                <label className="flex items-center gap-2 text-sm text-claude-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.include_hybrid ?? true}
                    onChange={(e) => updateConfigField("include_hybrid", e.target.checked)}
                    className="rounded accent-claude-accent"
                  />
                  Hybrid
                </label>
              </div>
              <p className="text-xs text-claude-tertiary mb-2">
                Add cities or states to filter jobs by location during scraping
              </p>
              <TagEditor
                label=""
                tags={config.locations ?? []}
                onAdd={handleAddTag("locations")}
                onRemove={handleRemoveTag("locations")}
                placeholder="Add city or state..."
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-claude-tertiary">No search config found.</p>
        )}
      </section>

      {/* Company Watchlist — only visible in company search mode */}
      {(config?.company_search_enabled ?? true) ? (
        <section className="bg-white border border-claude-border rounded-xl p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-semibold text-claude-primary mb-4">Company Watchlist</h2>
          <CompanyWatchlist
            companies={companies}
            onUpdate={fetchData}
          />
        </section>
      ) : (
        <section className="bg-white border border-claude-border rounded-xl p-6 mb-6 shadow-sm">
          <div className="text-center py-4">
            <p className="text-sm text-claude-secondary">
              Searching all companies using your keywords via Indeed, LinkedIn & ZipRecruiter.
            </p>
            <p className="text-xs text-claude-tertiary mt-1">
              Switch to Company Search mode above to manage a watchlist of specific companies.
            </p>
          </div>
        </section>
      )}

      {/* Scraper */}
      <section className="bg-white border border-claude-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-claude-primary mb-4">Job Scraper</h2>
        <ScrapeButton />
      </section>
    </div>
  );
}
