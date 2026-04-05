"use client";

import { useState, useEffect } from "react";
import { WatchlistCompany } from "@/lib/types";

interface CompanyFormProps {
  company: WatchlistCompany;
  onSave: (data: {
    name: string;
    greenhouse_slug: string | null;
    ashby_slug: string | null;
    lever_slug: string | null;
    website: string | null;
  }) => Promise<string | null>;
  onComplete: () => void;
  onCancel: () => void;
}

type SlugStatus = "idle" | "checking" | "valid" | "invalid";

export default function CompanyForm({
  company,
  onSave,
  onComplete,
  onCancel,
}: CompanyFormProps) {
  const [name, setName] = useState(company.name);
  const [website, setWebsite] = useState(company.website ?? "");
  const [greenhouseSlug, setGreenhouseSlug] = useState(company.greenhouse_slug ?? "");
  const [ashbySlug, setAshbySlug] = useState(company.ashby_slug ?? "");
  const [leverSlug, setLeverSlug] = useState(company.lever_slug ?? "");
  const [ghStatus, setGhStatus] = useState<SlugStatus>("idle");
  const [ashbyStatus, setAshbyStatus] = useState<SlugStatus>("idle");
  const [leverStatus, setLeverStatus] = useState<SlugStatus>("idle");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (company.greenhouse_slug) setGhStatus("valid");
    if (company.ashby_slug) setAshbyStatus("valid");
    if (company.lever_slug) setLeverStatus("valid");
  }, [company]);

  async function verifyGreenhouse() {
    if (!greenhouseSlug.trim()) { setGhStatus("idle"); return; }
    setGhStatus("checking");
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${greenhouseSlug.trim()}/jobs`
      );
      setGhStatus(res.ok ? "valid" : "invalid");
    } catch { setGhStatus("invalid"); }
  }

  async function verifyAshby() {
    if (!ashbySlug.trim()) { setAshbyStatus("idle"); return; }
    setAshbyStatus("checking");
    try {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${ashbySlug.trim()}`
      );
      setAshbyStatus(res.ok ? "valid" : "invalid");
    } catch { setAshbyStatus("invalid"); }
  }

  async function verifyLever() {
    if (!leverSlug.trim()) { setLeverStatus("idle"); return; }
    setLeverStatus("checking");
    try {
      const res = await fetch(
        `https://api.lever.co/v0/postings/${leverSlug.trim()}?mode=json&limit=1`
      );
      setLeverStatus(res.ok ? "valid" : "invalid");
    } catch { setLeverStatus("invalid"); }
  }

  function statusIcon(status: SlugStatus) {
    if (status === "checking") return <span className="text-claude-tertiary text-xs">...</span>;
    if (status === "valid") return <span className="text-emerald-600 text-sm">&#10003;</span>;
    if (status === "invalid") return <span className="text-red-500 text-sm">&#10007;</span>;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      greenhouse_slug: greenhouseSlug.trim() || null,
      ashby_slug: ashbySlug.trim() || null,
      lever_slug: leverSlug.trim() || null,
      website: website.trim() || null,
    });
    setSaving(false);
    onComplete();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-claude-bg border border-claude-border rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-claude-secondary mb-1">Company Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={saving}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent disabled:bg-claude-hover"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-claude-secondary mb-1">Website</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="e.g. openai.com"
            disabled={saving}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent disabled:bg-claude-hover"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-claude-secondary mb-1">
            Greenhouse {statusIcon(ghStatus)}
          </label>
          <input
            type="text"
            value={greenhouseSlug}
            onChange={(e) => { setGreenhouseSlug(e.target.value); setGhStatus("idle"); }}
            onBlur={verifyGreenhouse}
            placeholder="e.g. openai"
            disabled={saving}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent disabled:bg-claude-hover"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-claude-secondary mb-1">
            Lever {statusIcon(leverStatus)}
          </label>
          <input
            type="text"
            value={leverSlug}
            onChange={(e) => { setLeverSlug(e.target.value); setLeverStatus("idle"); }}
            onBlur={verifyLever}
            placeholder="e.g. netflix"
            disabled={saving}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent disabled:bg-claude-hover"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-claude-secondary mb-1">
            Ashby {statusIcon(ashbyStatus)}
          </label>
          <input
            type="text"
            value={ashbySlug}
            onChange={(e) => { setAshbySlug(e.target.value); setAshbyStatus("idle"); }}
            onBlur={verifyAshby}
            placeholder="e.g. listenlabs"
            disabled={saving}
            className="w-full border border-claude-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent disabled:bg-claude-hover"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover disabled:opacity-40"
        >
          {saving ? "Saving..." : "Update"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-3 py-1.5 bg-white text-claude-secondary text-sm border border-claude-border rounded-lg hover:bg-claude-hover disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
