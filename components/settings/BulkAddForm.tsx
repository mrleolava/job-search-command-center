"use client";

import { useState } from "react";
import { WatchlistCompany } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { PROFILE_ID } from "@/lib/profile";

interface BulkAddFormProps {
  existingCompanies: WatchlistCompany[];
  onComplete: () => void;
  onCancel: () => void;
}

interface CompanyResult {
  url: string;
  name: string;
  status: "pending" | "processing" | "added" | "skipped" | "failed";
  board: string | null;
  companyId: string | null;
  enrichStatus?: "pending" | "enriching" | "done" | "skipped";
  enrichFound?: string[];
  enrichMissing?: string[];
}

function parseUrls(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((line) =>
      line
        .replace(/^[\s\-\*\u2022\d.)]+/, "")
        .trim()
        .replace(/\/+$/, "")
    )
    .filter((url) => url.length > 0 && url.includes("."));
}

function extractCompanyName(url: string): string {
  const domain = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function normalizeUrl(url: string): string {
  let u = url.trim().toLowerCase();
  if (!u.startsWith("http")) u = "https://" + u;
  return u
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

const FRIENDLY_FIELD_NAMES: Record<string, string> = {
  funding_stage: "Funding",
  total_raised: "Raised",
  total_employees: "Employees",
  revenue_stage: "Revenue",
  key_investors: "Investors",
  glassdoor_rating: "Glassdoor",
  glassdoor_url: "Glassdoor URL",
  headquarters: "HQ",
  year_founded: "Founded",
  linkedin_url: "LinkedIn",
  ceo_name: "CEO",
  cro_name: "CRO",
  pe_revenue_exposure: "PE Exposure",
  last_funding_date: "Last Funding",
  last_funding_amount: "Last Round",
  competitors: "Competitors",
  tech_stack: "Tech",
  recent_news: "News",
};

function friendlyFieldName(field: string): string {
  return FRIENDLY_FIELD_NAMES[field] ?? field;
}

export default function BulkAddForm({
  existingCompanies,
  onComplete,
  onCancel,
}: BulkAddFormProps) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [enriching, setEnriching] = useState(false);
  const [enrichIndex, setEnrichIndex] = useState(0);
  const [enrichTotal, setEnrichTotal] = useState(0);
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const supabase = createClient();

  const existingNames = new Set(
    existingCompanies.map((c) => c.name.toLowerCase())
  );
  const existingDomains = new Set(
    existingCompanies
      .filter((c) => c.website)
      .map((c) => normalizeUrl(c.website!))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urls = parseUrls(input);
    if (urls.length === 0) return;

    setProcessing(true);
    setTotalCount(urls.length);
    setDone(false);
    setScrapeResult(null);

    const initialResults: CompanyResult[] = urls.map((url) => ({
      url,
      name: extractCompanyName(url),
      status: "pending",
      board: null,
      companyId: null,
    }));
    setResults(initialResults);

    const newCompanyIds: string[] = [];

    // Phase 1: Detect boards and insert
    for (let i = 0; i < initialResults.length; i++) {
      setCurrentIndex(i + 1);
      const r = { ...initialResults[i] };

      const domain = normalizeUrl(r.url);
      if (existingNames.has(r.name.toLowerCase()) || existingDomains.has(domain)) {
        r.status = "skipped";
        initialResults[i] = r;
        setResults([...initialResults]);
        continue;
      }

      r.status = "processing";
      initialResults[i] = r;
      setResults([...initialResults]);

      try {
        const detectRes = await fetch("/api/detect-boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: r.name, website: r.url }),
        });
        const detected = await detectRes.json();

        const boards: string[] = [];
        const gh = detected.greenhouse || null;
        const lev = detected.lever || null;
        const ash = detected.ashby || null;
        if (gh) boards.push("Greenhouse");
        if (lev) boards.push("Lever");
        if (ash) boards.push("Ashby");
        if (detected.workday) boards.push("Workday");

        r.board = boards.length > 0 ? boards[0] : null;

        const website = r.url.startsWith("http") ? r.url : `https://${r.url}`;
        const { data: inserted, error } = await supabase
          .from("watchlist_companies")
          .insert({
            name: r.name,
            website,
            greenhouse_slug: gh,
            lever_slug: lev,
            ashby_slug: ash,
            profile_id: PROFILE_ID,
          })
          .select("id")
          .single();

        if (error) {
          r.status = "failed";
        } else {
          r.status = "added";
          r.companyId = inserted?.id ?? null;
          if (r.companyId && (gh || lev || ash)) {
            newCompanyIds.push(r.companyId);
          }
          existingNames.add(r.name.toLowerCase());
          existingDomains.add(domain);
        }
      } catch {
        r.status = "failed";
      }

      initialResults[i] = r;
      setResults([...initialResults]);
    }

    setProcessing(false);

    // Phase 2: Enrich all added companies
    const addedResults = initialResults.filter(
      (r) => r.status === "added" && r.companyId
    );
    if (addedResults.length > 0) {
      setEnriching(true);
      setEnrichTotal(addedResults.length);

      for (let i = 0; i < addedResults.length; i++) {
        setEnrichIndex(i + 1);
        const r = addedResults[i];
        const idx = initialResults.indexOf(r);

        initialResults[idx] = { ...r, enrichStatus: "enriching" };
        setResults([...initialResults]);

        try {
          const res = await fetch("/api/enrich-company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: r.companyId }),
          });
          const enrichData = await res.json();

          initialResults[idx] = {
            ...initialResults[idx],
            enrichStatus: "done",
            enrichFound: enrichData.foundFields ?? [],
            enrichMissing: enrichData.missing ?? [],
          };
        } catch {
          initialResults[idx] = {
            ...initialResults[idx],
            enrichStatus: "done",
            enrichFound: [],
            enrichMissing: [],
          };
        }

        setResults([...initialResults]);
      }

      setEnriching(false);
    }

    // Phase 3: Auto-scrape
    if (newCompanyIds.length > 0) {
      setScraping(true);
      try {
        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyIds: newCompanyIds }),
        });
        const data = await res.json();
        if (res.ok) {
          setScrapeResult(data.inserted ?? 0);
        }
      } catch {
        // Scrape failed but companies are saved
      }
      setScraping(false);
    }

    setDone(true);
  }

  const addedCount = results.filter((r) => r.status === "added").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const failedCount = results.filter((r) => r.status === "failed").length;
  const isRunning = processing || enriching || scraping;

  return (
    <div className="bg-claude-bg border border-claude-border rounded-xl p-4 space-y-3">
      {!done ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-claude-secondary mb-1">
              Company Websites
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Paste company websites, one per line:\nanthropic.com\nopenai.com\nrogo.ai\nalphasense.com`}
              rows={5}
              disabled={isRunning}
              className="w-full border border-claude-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent disabled:bg-claude-hover font-mono"
            />
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="flex items-center gap-2 text-sm text-claude-secondary">
              <Spinner />
              {processing && `Detecting boards ${currentIndex} of ${totalCount}...`}
              {enriching && `Enriching company data ${enrichIndex} of ${enrichTotal}...`}
              {scraping && "Scraping jobs for new companies..."}
            </div>
          )}

          {/* Live results while processing */}
          {results.length > 0 && !done && (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <ResultRow key={i} result={r} />
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={!input.trim() || isRunning}
              className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover disabled:opacity-40"
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  {processing ? "Detecting..." : enriching ? "Enriching..." : "Scraping..."}
                </span>
              ) : (
                "Add Companies"
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isRunning}
              className="px-3 py-1.5 bg-white text-claude-secondary text-sm border border-claude-border rounded-lg hover:bg-claude-hover disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          {/* Summary */}
          <div className="text-sm space-y-1">
            {addedCount > 0 && (
              <div className="text-emerald-700 font-medium">
                Added {addedCount} {addedCount === 1 ? "company" : "companies"}
              </div>
            )}
            {skippedCount > 0 && (
              <div className="text-amber-600">
                Skipped {skippedCount} {skippedCount === 1 ? "duplicate" : "duplicates"}:{" "}
                {results
                  .filter((r) => r.status === "skipped")
                  .map((r) => r.name)
                  .join(", ")}
              </div>
            )}
            {failedCount > 0 && (
              <div className="text-red-600">
                Failed {failedCount}:{" "}
                {results
                  .filter((r) => r.status === "failed")
                  .map((r) => r.name)
                  .join(", ")}
              </div>
            )}
            {scrapeResult !== null && (
              <div className="text-emerald-700 font-medium">
                Found {scrapeResult} matching jobs
              </div>
            )}
          </div>

          {/* Result details */}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {results.map((r, i) => (
              <ResultRow key={i} result={r} />
            ))}
          </div>

          <button
            type="button"
            onClick={onComplete}
            className="px-3 py-1.5 bg-claude-accent text-white text-sm rounded-lg hover:bg-claude-accent-hover"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: CompanyResult }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        {result.status === "pending" && (
          <span className="text-claude-tertiary w-4 text-center">&middot;</span>
        )}
        {result.status === "processing" && <Spinner />}
        {result.status === "added" && (
          <span className="text-emerald-600 w-4 text-center">&check;</span>
        )}
        {result.status === "skipped" && (
          <span className="text-amber-500 w-4 text-center">&ndash;</span>
        )}
        {result.status === "failed" && (
          <span className="text-red-500 w-4 text-center">&times;</span>
        )}
        <span
          className={
            result.status === "skipped"
              ? "text-claude-tertiary"
              : result.status === "failed"
              ? "text-red-600"
              : "text-claude-secondary"
          }
        >
          {result.name}
        </span>
        {result.status === "added" && result.board && (
          <span className="text-xs text-emerald-600">({result.board})</span>
        )}
        {result.status === "added" && !result.board && (
          <span className="text-xs text-claude-tertiary">(no board detected)</span>
        )}
        {result.status === "skipped" && (
          <span className="text-xs text-amber-500">duplicate</span>
        )}
        {result.enrichStatus === "enriching" && (
          <span className="text-xs text-claude-tertiary flex items-center gap-1">
            <Spinner /> enriching...
          </span>
        )}
      </div>
      {/* Enrichment results */}
      {result.enrichStatus === "done" && result.enrichFound && result.enrichFound.length > 0 && (
        <div className="ml-6 text-xs text-claude-tertiary mt-0.5">
          <span className="text-emerald-600">Found:</span>{" "}
          {result.enrichFound.map((f) => friendlyFieldName(f)).join(", ")}
          {result.enrichMissing && result.enrichMissing.length > 0 && (
            <span className="ml-1">
              <span className="text-claude-border">|</span>{" "}
              <span className="text-amber-500">Missing:</span>{" "}
              {result.enrichMissing.slice(0, 5).map((f) => friendlyFieldName(f)).join(", ")}
              {result.enrichMissing.length > 5 && ` +${result.enrichMissing.length - 5} more`}
            </span>
          )}
        </div>
      )}
      {result.enrichStatus === "done" && result.enrichFound && result.enrichFound.length === 0 && (
        <div className="ml-6 text-xs text-amber-500 mt-0.5">
          No data found — add manually in Settings
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-claude-tertiary shrink-0"
      viewBox="0 0 24 24"
    >
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
  );
}
