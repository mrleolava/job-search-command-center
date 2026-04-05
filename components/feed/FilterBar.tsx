"use client";

import { useState, useRef, useEffect } from "react";
import MultiSelect from "./MultiSelect";

export interface FilterState {
  search: string;
  sortBy: string;
  locations: string[];
  companies: string[];
  dateRange: string;
  minSalary: number;
  maxSalary: number;
  hideNoSalary: boolean;
  minSeniority: number;
  remoteOnly: boolean;
  hybridOnly: boolean;
  activeCompaniesOnly: boolean;
  showDismissed: boolean;
  peExposure: string[];
  fundingStages: string[];
  revenueStages: string[];
  minGrowth: string;
  minGlassdoor: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  allLocations: string[];
  locationCounts: Record<string, number>;
  allCompanies: string[];
  totalCount: number;
  filteredCount: number;
}

const DATE_OPTIONS = [
  { label: "Today", value: "1" },
  { label: "3d", value: "3" },
  { label: "Week", value: "7" },
  { label: "2W", value: "14" },
  { label: "Month", value: "30" },
];

const SENIORITY_OPTIONS = [
  { label: "All", value: 1 },
  { label: "Sr+", value: 2 },
  { label: "Dir+", value: 3 },
  { label: "VP+", value: 4 },
  { label: "C-Suite", value: 5 },
];

const SORT_OPTIONS = [
  { label: "Date Posted", value: "date" },
  { label: "Salary", value: "salary" },
  { label: "Seniority", value: "seniority" },
  { label: "Company Fit", value: "companyFit" },
  { label: "Company (A-Z)", value: "companyAZ" },
  { label: "Company (Z-A)", value: "companyZA" },
  { label: "Title (A-Z)", value: "titleAZ" },
  { label: "Title (Z-A)", value: "titleZA" },
  { label: "PE Exposure", value: "peExposure" },
  { label: "Employee Growth", value: "employeeGrowth" },
  { label: "Glassdoor", value: "glassdoor" },
  { label: "Funding Stage", value: "fundingStage" },
  { label: "Relevance", value: "relevance" },
];

const PE_OPTIONS = ["Core (>50%)", "Significant (20-50%)", "Emerging (<20%)", "None/Unknown"];
const FUNDING_OPTIONS = [
  { label: "Seed", value: "Seed" },
  { label: "Series A", value: "Series A" },
  { label: "Series B", value: "Series B" },
  { label: "Series C", value: "Series C" },
  { label: "D+", value: "Series D+" },
  { label: "PE", value: "PE-backed" },
  { label: "Public", value: "Public" },
  { label: "Private", value: "Private/Bootstrapped" },
];
const REVENUE_OPTIONS = [
  { label: "Pre-rev", value: "Pre-revenue" },
  { label: "<$1M", value: "<$1M ARR" },
  { label: "$1-10M", value: "$1-10M ARR" },
  { label: "$10-50M", value: "$10-50M ARR" },
  { label: "$50-100M", value: "$50-100M ARR" },
  { label: "$100M+", value: "$100M+ ARR" },
];

const GROWTH_OPTIONS = [
  { label: ">15%", value: "15" },
  { label: ">5%", value: "5" },
];

const GLASSDOOR_OPTIONS = [
  { label: ">4.0", value: "4.0" },
  { label: ">3.5", value: "3.5" },
];

function Sep() {
  return <span className="text-claude-border mx-0.5 select-none">|</span>;
}

export default function FilterBar({
  filters,
  onChange,
  allLocations,
  locationCounts,
  allCompanies,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleInArray(arr: string[], val: string): string[] {
    return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
  }

  // Count active filters
  let activeCount = 0;
  if (filters.dateRange) activeCount++;
  if (filters.minSeniority > 1) activeCount++;
  if (filters.remoteOnly) activeCount++;
  if (filters.hybridOnly) activeCount++;
  if (filters.minSalary > 0) activeCount++;
  if (filters.maxSalary > 0) activeCount++;
  if (filters.hideNoSalary) activeCount++;
  if (filters.locations.length > 0) activeCount++;
  if (filters.companies.length > 0) activeCount++;
  if (filters.showDismissed) activeCount++;
  if (filters.peExposure.length > 0) activeCount++;
  if (filters.fundingStages.length > 0) activeCount++;
  if (filters.revenueStages.length > 0) activeCount++;
  if (filters.minGrowth) activeCount++;
  if (filters.minGlassdoor) activeCount++;

  // Build chips for active filters
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.search) chips.push({ label: `"${filters.search}"`, clear: () => set("search", "") });
  if (filters.dateRange) {
    const d = DATE_OPTIONS.find((o) => o.value === filters.dateRange);
    chips.push({ label: d?.label ?? `${filters.dateRange}d`, clear: () => set("dateRange", "") });
  }
  if (filters.minSeniority > 1) {
    const s = SENIORITY_OPTIONS.find((o) => o.value === filters.minSeniority);
    chips.push({ label: s?.label ?? `Seniority ${filters.minSeniority}+`, clear: () => set("minSeniority", 1) });
  }
  if (filters.remoteOnly) chips.push({ label: "Remote", clear: () => set("remoteOnly", false) });
  if (filters.hybridOnly) chips.push({ label: "Hybrid", clear: () => set("hybridOnly", false) });
  if (filters.minSalary > 0) chips.push({ label: `>$${filters.minSalary}k`, clear: () => set("minSalary", 0) });
  if (filters.maxSalary > 0) chips.push({ label: `<$${filters.maxSalary}k`, clear: () => set("maxSalary", 0) });
  if (filters.hideNoSalary) chips.push({ label: "Has salary", clear: () => set("hideNoSalary", false) });
  for (const loc of filters.locations) {
    chips.push({ label: loc, clear: () => set("locations", filters.locations.filter((l) => l !== loc)) });
  }
  for (const co of filters.companies) {
    chips.push({ label: co, clear: () => set("companies", filters.companies.filter((c) => c !== co)) });
  }
  if (!filters.activeCompaniesOnly) chips.push({ label: "All companies", clear: () => set("activeCompaniesOnly", true) });
  if (filters.showDismissed) chips.push({ label: "Dismissed", clear: () => set("showDismissed", false) });
  for (const pe of filters.peExposure) {
    chips.push({ label: `PE: ${pe.split(" ")[0]}`, clear: () => set("peExposure", filters.peExposure.filter((p) => p !== pe)) });
  }
  for (const fs of filters.fundingStages) {
    chips.push({ label: fs, clear: () => set("fundingStages", filters.fundingStages.filter((f) => f !== fs)) });
  }
  for (const rs of filters.revenueStages) {
    chips.push({ label: rs, clear: () => set("revenueStages", filters.revenueStages.filter((r) => r !== rs)) });
  }
  if (filters.minGrowth) chips.push({ label: `Growth >${filters.minGrowth}%`, clear: () => set("minGrowth", "") });
  if (filters.minGlassdoor) chips.push({ label: `GD >${filters.minGlassdoor}`, clear: () => set("minGlassdoor", "") });

  const hasActiveFilters = chips.length > 0;

  function clearAll() {
    onChange({
      search: "", sortBy: "date", locations: [], companies: [], dateRange: "",
      minSalary: 0, maxSalary: 0, hideNoSalary: false, minSeniority: 1,
      remoteOnly: false, hybridOnly: false, activeCompaniesOnly: true, showDismissed: false,
      peExposure: [], fundingStages: [], revenueStages: [], minGrowth: "", minGlassdoor: "",
    });
  }

  const pill = "px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap";
  const on = "bg-claude-accent text-white";
  const off = "bg-claude-hover text-claude-secondary hover:bg-claude-border";

  return (
    <div className="mb-2 space-y-2">
      {/* Row 1: Search + Sort + Filter toggle */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="Search jobs..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="border border-claude-border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[180px] bg-white focus:outline-none focus:ring-2 focus:ring-claude-accent focus:border-transparent"
        />
        <select
          value={filters.sortBy}
          onChange={(e) => set("sortBy", e.target.value)}
          className="border border-claude-border rounded-lg px-2 py-1.5 text-sm bg-white"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
            expanded || activeCount > 0
              ? "bg-claude-accent text-white"
              : "bg-claude-hover text-claude-secondary hover:bg-claude-border"
          }`}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ""}
          <svg
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Row 2: Collapsible filter pills */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-1.5 py-1">
          {/* Date */}
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("dateRange", filters.dateRange === opt.value ? "" : opt.value)}
              className={`${pill} ${filters.dateRange === opt.value ? on : off}`}
            >
              {opt.label}
            </button>
          ))}
          <Sep />
          {/* Seniority */}
          {SENIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("minSeniority", filters.minSeniority === opt.value ? 1 : opt.value)}
              className={`${pill} ${filters.minSeniority === opt.value ? on : off}`}
            >
              {opt.label}
            </button>
          ))}
          <Sep />
          {/* Remote + Hybrid */}
          <button
            onClick={() => set("remoteOnly", !filters.remoteOnly)}
            className={`${pill} ${filters.remoteOnly ? on : off}`}
          >
            Remote
          </button>
          <button
            onClick={() => set("hybridOnly", !filters.hybridOnly)}
            className={`${pill} ${filters.hybridOnly ? on : off}`}
          >
            Hybrid
          </button>
          <button
            onClick={() => set("activeCompaniesOnly", !filters.activeCompaniesOnly)}
            className={`${pill} ${filters.activeCompaniesOnly ? on : off}`}
          >
            Active Co.
          </button>
          <Sep />
          {/* Salary */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0} max={500} step={25}
              value={filters.minSalary || ""}
              onChange={(e) => set("minSalary", Number(e.target.value) || 0)}
              placeholder="Min $k"
              className="border border-claude-border rounded-full px-2 py-1 text-xs w-[68px] bg-white"
            />
            <span className="text-claude-tertiary text-xs">–</span>
            <input
              type="number"
              min={0} max={500} step={25}
              value={filters.maxSalary || ""}
              onChange={(e) => set("maxSalary", Number(e.target.value) || 0)}
              placeholder="Max $k"
              className="border border-claude-border rounded-full px-2 py-1 text-xs w-[68px] bg-white"
            />
          </div>
          <Sep />
          {/* Location + Company */}
          <MultiSelect label="Location" options={allLocations} selected={filters.locations} onChange={(v) => set("locations", v)} counts={locationCounts} />
          <MultiSelect label="Company" options={allCompanies} selected={filters.companies} onChange={(v) => set("companies", v)} />
          <Sep />
          {/* PE */}
          {PE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => set("peExposure", toggleInArray(filters.peExposure, opt))}
              className={`${pill} ${filters.peExposure.includes(opt) ? on : off}`}
            >
              {opt.split(" ")[0]}
            </button>
          ))}
          <Sep />
          {/* Growth */}
          {GROWTH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("minGrowth", filters.minGrowth === opt.value ? "" : opt.value)}
              className={`${pill} ${filters.minGrowth === opt.value ? on : off}`}
            >
              Growth {opt.label}
            </button>
          ))}
          <Sep />
          {/* Glassdoor */}
          {GLASSDOOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("minGlassdoor", filters.minGlassdoor === opt.value ? "" : opt.value)}
              className={`${pill} ${filters.minGlassdoor === opt.value ? on : off}`}
            >
              GD {opt.label}
            </button>
          ))}
          <Sep />
          {/* Funding */}
          {FUNDING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("fundingStages", toggleInArray(filters.fundingStages, opt.value))}
              className={`${pill} ${filters.fundingStages.includes(opt.value) ? on : off}`}
            >
              {opt.label}
            </button>
          ))}
          <Sep />
          {/* Revenue */}
          {REVENUE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("revenueStages", toggleInArray(filters.revenueStages, opt.value))}
              className={`${pill} ${filters.revenueStages.includes(opt.value) ? on : off}`}
            >
              {opt.label}
            </button>
          ))}
          <Sep />
          {/* More dropdown */}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`${pill} flex items-center gap-1 ${
                (filters.hideNoSalary || filters.showDismissed) ? on : off
              }`}
            >
              More
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {moreOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-claude-border rounded-xl shadow-lg z-50 py-1 min-w-[160px]">
                <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-claude-secondary hover:bg-claude-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hideNoSalary}
                    onChange={(e) => set("hideNoSalary", e.target.checked)}
                    className="rounded accent-claude-accent"
                  />
                  Hide no salary
                </label>
                <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-claude-secondary hover:bg-claude-hover cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showDismissed}
                    onChange={(e) => set("showDismissed", e.target.checked)}
                    className="rounded accent-claude-accent"
                  />
                  Show dismissed
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row 3: Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-claude-tertiary">
            {filteredCount}/{totalCount}
          </span>
          {chips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-claude-hover text-claude-secondary text-xs px-2 py-0.5 rounded-full"
            >
              {chip.label}
              <button onClick={chip.clear} className="text-claude-tertiary hover:text-claude-secondary">&times;</button>
            </span>
          ))}
          <button onClick={clearAll} className="text-xs text-claude-tertiary hover:text-claude-secondary underline">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
