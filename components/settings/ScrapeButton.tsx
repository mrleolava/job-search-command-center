"use client";

import { useState } from "react";

interface ScrapeButtonProps {
  profileId: string;
}

export default function ScrapeButton({ profileId }: ScrapeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScrape() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scrape failed");
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleScrape}
        disabled={loading}
        className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {loading ? "Scraping..." : "Run Scraper Now"}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          <p className="font-medium mb-1">Scrape complete</p>
          <ul className="space-y-0.5 text-xs">
            <li>Fetched: {result.fetched} jobs from APIs</li>
            <li>After filters: {result.filtered}</li>
            <li>After seniority: {result.afterSeniority}</li>
            <li>New jobs inserted: {result.inserted}</li>
            {result.salaryUpdated > 0 && (
              <li>Salary backfilled: {result.salaryUpdated}</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
