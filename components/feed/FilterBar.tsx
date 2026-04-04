"use client";

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
  showDismissed: boolean;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  allLocations: string[];
  allCompanies: string[];
  totalCount: number;
  filteredCount: number;
}

const DATE_OPTIONS = [
  { label: "Today", value: "1" },
  { label: "3 days", value: "3" },
  { label: "Week", value: "7" },
  { label: "2 weeks", value: "14" },
  { label: "Month", value: "30" },
];

const SENIORITY_OPTIONS = [
  { label: "All", value: 1 },
  { label: "Senior+", value: 2 },
  { label: "Director+", value: 3 },
  { label: "VP+", value: 4 },
  { label: "C-Suite", value: 5 },
];

const SORT_OPTIONS = [
  { label: "Date Posted", value: "date" },
  { label: "Salary", value: "salary" },
  { label: "Seniority", value: "seniority" },
  { label: "Company", value: "company" },
  { label: "Relevance", value: "relevance" },
];

export default function FilterBar({
  filters,
  onChange,
  allLocations,
  allCompanies,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  // Collect active filter chips
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.search) chips.push({ label: `"${filters.search}"`, clear: () => set("search", "") });
  if (filters.minSalary > 0) chips.push({ label: `Min $${filters.minSalary}k`, clear: () => set("minSalary", 0) });
  if (filters.maxSalary > 0) chips.push({ label: `Max $${filters.maxSalary}k`, clear: () => set("maxSalary", 0) });
  if (filters.hideNoSalary) chips.push({ label: "Hide no salary", clear: () => set("hideNoSalary", false) });
  if (filters.dateRange) {
    const d = DATE_OPTIONS.find((o) => o.value === filters.dateRange);
    chips.push({ label: d?.label ?? `${filters.dateRange}d`, clear: () => set("dateRange", "") });
  }
  if (filters.minSeniority > 1) {
    const s = SENIORITY_OPTIONS.find((o) => o.value === filters.minSeniority);
    chips.push({ label: s?.label ?? `Seniority ${filters.minSeniority}+`, clear: () => set("minSeniority", 1) });
  }
  if (filters.remoteOnly) chips.push({ label: "Remote only", clear: () => set("remoteOnly", false) });
  for (const loc of filters.locations) {
    chips.push({ label: loc, clear: () => set("locations", filters.locations.filter((l) => l !== loc)) });
  }
  for (const co of filters.companies) {
    chips.push({ label: co, clear: () => set("companies", filters.companies.filter((c) => c !== co)) });
  }
  if (filters.showDismissed) chips.push({ label: "Show dismissed", clear: () => set("showDismissed", false) });

  function clearAll() {
    onChange({
      search: "",
      sortBy: "date",
      locations: [],
      companies: [],
      dateRange: "",
      minSalary: 0,
      maxSalary: 0,
      hideNoSalary: false,
      minSeniority: 1,
      remoteOnly: false,
      showDismissed: false,
    });
  }

  const hasActiveFilters = chips.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 space-y-3">
      {/* Row 1: Search + Sort */}
      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search jobs..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <select
          value={filters.sortBy}
          onChange={(e) => set("sortBy", e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: Date + Seniority + Work type */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Date quick buttons */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Date:</span>
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("dateRange", filters.dateRange === opt.value ? "" : opt.value)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                filters.dateRange === opt.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-gray-200">|</span>

        {/* Seniority buttons */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500 mr-1">Level:</span>
          {SENIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("minSeniority", filters.minSeniority === opt.value ? 1 : opt.value)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                filters.minSeniority === opt.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-gray-200">|</span>

        {/* Work type */}
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.remoteOnly}
            onChange={(e) => set("remoteOnly", e.target.checked)}
            className="rounded accent-gray-900"
          />
          <span className="text-xs">Remote only</span>
        </label>
      </div>

      {/* Row 3: Salary + Location + Company + Dismissed */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Salary range */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-xs text-gray-500">Salary:</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={500}
              step={25}
              value={filters.minSalary || ""}
              onChange={(e) => set("minSalary", Number(e.target.value) || 0)}
              placeholder="Min $k"
              className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-20"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              min={0}
              max={500}
              step={25}
              value={filters.maxSalary || ""}
              onChange={(e) => set("maxSalary", Number(e.target.value) || 0)}
              placeholder="Max $k"
              className="border border-gray-300 rounded-md px-2 py-1.5 text-xs w-20"
            />
          </div>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.hideNoSalary}
              onChange={(e) => set("hideNoSalary", e.target.checked)}
              className="rounded accent-gray-900"
            />
            Hide no salary
          </label>
        </div>

        <span className="text-gray-200">|</span>

        <MultiSelect
          label="Location"
          options={allLocations}
          selected={filters.locations}
          onChange={(v) => set("locations", v)}
        />

        <MultiSelect
          label="Company"
          options={allCompanies}
          selected={filters.companies}
          onChange={(v) => set("companies", v)}
        />

        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={filters.showDismissed}
            onChange={(e) => set("showDismissed", e.target.checked)}
            className="rounded accent-gray-900"
          />
          Show dismissed
        </label>
      </div>

      {/* Active filters + count */}
      {(hasActiveFilters || filteredCount !== totalCount) && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Showing {filteredCount} of {totalCount} jobs
          </span>
          {chips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-md"
            >
              {chip.label}
              <button
                onClick={chip.clear}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </span>
          ))}
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
