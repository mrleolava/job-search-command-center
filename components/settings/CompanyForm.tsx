"use client";

import { useState, useEffect } from "react";
import { WatchlistCompany } from "@/lib/types";

interface CompanyFormProps {
  company?: WatchlistCompany;
  profileId: string;
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
type PipelineStep = "idle" | "detecting" | "saving" | "scraping" | "done";

export default function CompanyForm({
  company,
  profileId,
  onSave,
  onComplete,
  onCancel,
}: CompanyFormProps) {
  const [name, setName] = useState(company?.name ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [greenhouseSlug, setGreenhouseSlug] = useState(company?.greenhouse_slug ?? "");
  const [ashbySlug, setAshbySlug] = useState(company?.ashby_slug ?? "");
  const [leverSlug, setLeverSlug] = useState(company?.lever_slug ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ghStatus, setGhStatus] = useState<SlugStatus>("idle");
  const [ashbyStatus, setAshbyStatus] = useState<SlugStatus>("idle");
  const [leverStatus, setLeverStatus] = useState<SlugStatus>("idle");

  // Pipeline state (for new company add)
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("idle");
  const [detectResults, setDetectResults] = useState<string[]>([]);
  const [scrapeResult, setScrapeResult] = useState<{ inserted: number } | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const isEditing = !!company;

  useEffect(() => {
    if (company?.greenhouse_slug) setGhStatus("valid");
    if (company?.ashby_slug) setAshbyStatus("valid");
    if (company?.lever_slug) setLeverStatus("valid");
    if (company?.greenhouse_slug || company?.ashby_slug || company?.lever_slug) {
      setShowAdvanced(true);
    }
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
    if (status === "checking") return <span className="text-gray-400 text-xs">...</span>;
    if (status === "valid") return <span className="text-green-600 text-sm">&#10003;</span>;
    if (status === "invalid") return <span className="text-red-500 text-sm">&#10007;</span>;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    // For editing, just save directly
    if (isEditing) {
      await onSave({
        name: name.trim(),
        greenhouse_slug: greenhouseSlug.trim() || null,
        ashby_slug: ashbySlug.trim() || null,
        lever_slug: leverSlug.trim() || null,
        website: website.trim() || null,
      });
      onComplete();
      return;
    }

    // New company pipeline: detect → save → scrape
    setPipelineStep("detecting");
    setPipelineError(null);
    setDetectResults([]);
    setScrapeResult(null);

    // Use manually-entered slugs as starting point
    let gh = greenhouseSlug.trim() || null;
    let lev = leverSlug.trim() || null;
    let ash = ashbySlug.trim() || null;

    // Step 1: Auto-detect job boards
    try {
      const res = await fetch("/api/detect-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), website: website.trim() || null }),
      });
      const data = await res.json();
      const found: string[] = [];

      if (data.greenhouse && !gh) {
        gh = data.greenhouse;
        setGreenhouseSlug(data.greenhouse);
        setGhStatus("valid");
      }
      if (gh) found.push("Greenhouse");

      if (data.lever && !lev) {
        lev = data.lever;
        setLeverSlug(data.lever);
        setLeverStatus("valid");
      }
      if (lev) found.push("Lever");

      if (data.ashby && !ash) {
        ash = data.ashby;
        setAshbySlug(data.ashby);
        setAshbyStatus("valid");
      }
      if (ash) found.push("Ashby");

      if (data.workday) found.push("Workday");

      setDetectResults(found);
    } catch {
      // Detection failed, continue anyway
    }

    // Step 2: Save company
    setPipelineStep("saving");
    const companyId = await onSave({
      name: name.trim(),
      greenhouse_slug: gh,
      ashby_slug: ash,
      lever_slug: lev,
      website: website.trim() || null,
    });

    if (!companyId) {
      setPipelineError("Failed to save company");
      setPipelineStep("done");
      return;
    }

    // Step 3: Scrape jobs (only if a scrapable slug was found)
    if (gh || lev || ash) {
      setPipelineStep("scraping");
      try {
        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, companyId }),
        });
        const data = await res.json();
        if (res.ok) {
          setScrapeResult({ inserted: data.inserted ?? 0 });
        }
      } catch {
        // Scrape failed, but company is saved
      }
    }

    setPipelineStep("done");
  }

  const isPipelineRunning = pipelineStep !== "idle" && pipelineStep !== "done";

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      {/* Required fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isPipelineRunning}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Website URL *</label>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="e.g. openai.com"
          required={!isEditing}
          disabled={isPipelineRunning}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
        />
      </div>

      {/* Collapsible Advanced section for slug fields */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          disabled={isPipelineRunning}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span className="text-xs">{showAdvanced ? "\u25BC" : "\u25B6"}</span>
          Advanced
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Greenhouse {statusIcon(ghStatus)}
              </label>
              <input
                type="text"
                value={greenhouseSlug}
                onChange={(e) => { setGreenhouseSlug(e.target.value); setGhStatus("idle"); }}
                onBlur={verifyGreenhouse}
                placeholder="e.g. openai"
                disabled={isPipelineRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lever {statusIcon(leverStatus)}
              </label>
              <input
                type="text"
                value={leverSlug}
                onChange={(e) => { setLeverSlug(e.target.value); setLeverStatus("idle"); }}
                onBlur={verifyLever}
                placeholder="e.g. netflix"
                disabled={isPipelineRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ashby {statusIcon(ashbyStatus)}
              </label>
              <input
                type="text"
                value={ashbySlug}
                onChange={(e) => { setAshbySlug(e.target.value); setAshbyStatus("idle"); }}
                onBlur={verifyAshby}
                placeholder="e.g. listenlabs"
                disabled={isPipelineRunning}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100"
              />
            </div>
          </div>
        )}
      </div>

      {/* Pipeline status */}
      {pipelineStep !== "idle" && (
        <div className="space-y-2 pt-2 border-t border-gray-200">
          {/* Detecting */}
          {pipelineStep === "detecting" && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Spinner />
              Detecting job board...
            </div>
          )}

          {/* Detection results (shown after detecting phase) */}
          {pipelineStep !== "detecting" && (
            detectResults.length > 0 ? (
              <div className="text-sm text-green-700 font-medium">
                Found: {detectResults.map((r) => `${r} \u2713`).join(", ")}
              </div>
            ) : (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                No job board detected &mdash; you can manually enter a slug or this company will be searched via LinkedIn/Indeed only
              </div>
            )
          )}

          {/* Scraping */}
          {pipelineStep === "scraping" && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Spinner />
              Scraping jobs...
            </div>
          )}

          {/* Scrape results */}
          {pipelineStep === "done" && scrapeResult && (
            <div className="text-sm text-green-700 font-medium">
              Found {scrapeResult.inserted} matching jobs
            </div>
          )}

          {pipelineError && (
            <div className="text-sm text-red-600">{pipelineError}</div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {pipelineStep === "done" ? (
          <button
            type="button"
            onClick={onComplete}
            className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="submit"
              disabled={!name.trim() || isPipelineRunning}
              className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-40"
            >
              {isPipelineRunning ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  {pipelineStep === "detecting" ? "Detecting..." : pipelineStep === "saving" ? "Saving..." : "Scraping..."}
                </span>
              ) : isEditing ? "Update" : "Add Company"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPipelineRunning}
              className="px-3 py-1.5 bg-white text-gray-700 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-gray-500" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
