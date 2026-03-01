"use client";

import { useState, useEffect } from "react";
import { WatchlistCompany } from "@/lib/types";

interface CompanyFormProps {
  company?: WatchlistCompany;
  onSave: (data: {
    name: string;
    greenhouse_slug: string | null;
    ashby_slug: string | null;
    lever_slug: string | null;
    website: string | null;
  }) => void;
  onCancel: () => void;
}

type SlugStatus = "idle" | "checking" | "valid" | "invalid";
type DetectStatus = "idle" | "detecting" | "done";

export default function CompanyForm({ company, onSave, onCancel }: CompanyFormProps) {
  const [name, setName] = useState(company?.name ?? "");
  const [greenhouseSlug, setGreenhouseSlug] = useState(company?.greenhouse_slug ?? "");
  const [ashbySlug, setAshbySlug] = useState(company?.ashby_slug ?? "");
  const [leverSlug, setLeverSlug] = useState(company?.lever_slug ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [ghStatus, setGhStatus] = useState<SlugStatus>("idle");
  const [ashbyStatus, setAshbyStatus] = useState<SlugStatus>("idle");
  const [leverStatus, setLeverStatus] = useState<SlugStatus>("idle");
  const [detectStatus, setDetectStatus] = useState<DetectStatus>("idle");
  const [detectResults, setDetectResults] = useState<string[]>([]);

  useEffect(() => {
    if (company?.greenhouse_slug && greenhouseSlug === company.greenhouse_slug) {
      setGhStatus("valid");
    }
    if (company?.ashby_slug && ashbySlug === company.ashby_slug) {
      setAshbyStatus("valid");
    }
    if (company?.lever_slug && leverSlug === company.lever_slug) {
      setLeverStatus("valid");
    }
  }, [company, greenhouseSlug, ashbySlug, leverSlug]);

  async function autoDetect() {
    if (!name.trim()) return;
    setDetectStatus("detecting");
    setDetectResults([]);

    try {
      const res = await fetch("/api/detect-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), website: website.trim() || null }),
      });
      const data = await res.json();
      const found: string[] = [];

      if (data.greenhouse) {
        setGreenhouseSlug(data.greenhouse);
        setGhStatus("valid");
        found.push("Greenhouse");
      }
      if (data.lever) {
        setLeverSlug(data.lever);
        setLeverStatus("valid");
        found.push("Lever");
      }
      if (data.ashby) {
        setAshbySlug(data.ashby);
        setAshbyStatus("valid");
        found.push("Ashby");
      }

      setDetectResults(found);
    } catch {
      // Detection failed silently
    }
    setDetectStatus("done");
  }

  async function verifyGreenhouse() {
    if (!greenhouseSlug.trim()) { setGhStatus("idle"); return; }
    setGhStatus("checking");
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${greenhouseSlug.trim()}/jobs`
      );
      setGhStatus(res.ok ? "valid" : "invalid");
    } catch {
      setGhStatus("invalid");
    }
  }

  async function verifyAshby() {
    if (!ashbySlug.trim()) { setAshbyStatus("idle"); return; }
    setAshbyStatus("checking");
    try {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${ashbySlug.trim()}`
      );
      setAshbyStatus(res.ok ? "valid" : "invalid");
    } catch {
      setAshbyStatus("invalid");
    }
  }

  async function verifyLever() {
    if (!leverSlug.trim()) { setLeverStatus("idle"); return; }
    setLeverStatus("checking");
    try {
      const res = await fetch(
        `https://api.lever.co/v0/postings/${leverSlug.trim()}?mode=json&limit=1`
      );
      setLeverStatus(res.ok ? "valid" : "invalid");
    } catch {
      setLeverStatus("invalid");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      greenhouse_slug: greenhouseSlug.trim() || null,
      ashby_slug: ashbySlug.trim() || null,
      lever_slug: leverSlug.trim() || null,
      website: website.trim() || null,
    });
  }

  function statusIcon(status: SlugStatus) {
    if (status === "checking") return <span className="text-gray-400 text-xs">...</span>;
    if (status === "valid") return <span className="text-green-600 text-sm">&#10003;</span>;
    if (status === "invalid") return <span className="text-red-500 text-sm">&#10007;</span>;
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="e.g. openai.com"
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Auto-detect button */}
      <div>
        <button
          type="button"
          onClick={autoDetect}
          disabled={!name.trim() || detectStatus === "detecting"}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-40"
        >
          {detectStatus === "detecting" ? "Checking job boards..." : "Detect Job Boards"}
        </button>
        {detectStatus === "done" && (
          <span className="ml-2 text-sm">
            {detectResults.length > 0 ? (
              <span className="text-green-700">
                Found: {detectResults.map((r) => `${r} \u2713`).join(", ")}
              </span>
            ) : (
              <span className="text-gray-500">No job boards detected</span>
            )}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
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
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={!name.trim()}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-40"
        >
          {company ? "Update" : "Add Company"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-white text-gray-700 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
