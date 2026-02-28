"use client";

interface FilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
  source: string;
  onSourceChange: (v: string) => void;
  dateRange: string;
  onDateRangeChange: (v: string) => void;
  remoteOnly: boolean;
  onRemoteOnlyChange: (v: boolean) => void;
  showDismissed: boolean;
  onShowDismissedChange: (v: boolean) => void;
  locations: string[];
  sources: string[];
}

export default function FilterBar({
  search,
  onSearchChange,
  location,
  onLocationChange,
  source,
  onSourceChange,
  dateRange,
  onDateRangeChange,
  remoteOnly,
  onRemoteOnlyChange,
  showDismissed,
  onShowDismissedChange,
  locations,
  sources,
}: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <select
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">All Locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="">Any Date</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={remoteOnly}
            onChange={(e) => onRemoteOnlyChange(e.target.checked)}
            className="rounded"
          />
          Remote only
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={(e) => onShowDismissedChange(e.target.checked)}
            className="rounded"
          />
          Show dismissed
        </label>
      </div>
    </div>
  );
}
