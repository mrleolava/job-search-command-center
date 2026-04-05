// ─── City Matchers ───────────────────────────────────────────────
// Each entry: [regex to test against lowercased location, normalized city name]
const CITY_MATCHERS: [RegExp, string][] = [
  // New York
  [/\bnew\s*york/i, "New York"],
  [/\bnyc\b/i, "New York"],
  [/\bmanhattan\b/i, "New York"],
  [/\bbrooklyn\b/i, "New York"],
  [/\bmidtown\b/i, "New York"],
  [/\bqueens\b/i, "New York"],
  [/\bbronx\b/i, "New York"],
  [/,\s*ny\b/i, "New York"],
  [/\bny\s*,/i, "New York"],
  [/\bny\s*metro/i, "New York"],

  // San Francisco / Bay Area
  [/\bsan\s*francisco/i, "San Francisco"],
  [/\bsf\b/i, "San Francisco"],
  [/\bbay\s*area/i, "San Francisco"],
  [/\bpalo\s*alto/i, "San Francisco"],
  [/\bmountain\s*view/i, "San Francisco"],
  [/\bmenlo\s*park/i, "San Francisco"],
  [/\bsunnyvale/i, "San Francisco"],
  [/\bredwood\s*city/i, "San Francisco"],
  [/\bsan\s*jose/i, "San Francisco"],
  [/\bsan\s*mateo/i, "San Francisco"],
  [/\bcupertino/i, "San Francisco"],
  [/\boakland/i, "San Francisco"],
  [/\bberkeley/i, "San Francisco"],
  [/\bsouth\s*bay/i, "San Francisco"],
  [/\bsilicon\s*valley/i, "San Francisco"],
  [/\bfremont/i, "San Francisco"],

  // Boston
  [/\bboston/i, "Boston"],
  [/\bcambridge,?\s*ma\b/i, "Boston"],
  [/\bsomerville,?\s*ma\b/i, "Boston"],

  // Chicago
  [/\bchicago/i, "Chicago"],

  // Los Angeles
  [/\blos\s*angeles/i, "Los Angeles"],
  [/\bsanta\s*monica/i, "Los Angeles"],
  [/\bhollywood/i, "Los Angeles"],
  [/\bburbank/i, "Los Angeles"],
  [/\bpasadena,?\s*ca\b/i, "Los Angeles"],
  [/\bculver\s*city/i, "Los Angeles"],
  [/\bvenice,?\s*ca\b/i, "Los Angeles"],
  [/\bla,?\s*ca\b/i, "Los Angeles"],

  // Seattle
  [/\bseattle/i, "Seattle"],
  [/\bbellevue,?\s*wa\b/i, "Seattle"],
  [/\bredmond,?\s*wa\b/i, "Seattle"],
  [/\bkirkland,?\s*wa\b/i, "Seattle"],

  // Washington DC
  [/\bwashington,?\s*d\.?c/i, "Washington DC"],
  [/\bd\.?c\.?\s*metro/i, "Washington DC"],
  [/\barlington,?\s*va\b/i, "Washington DC"],
  [/\bbethesda/i, "Washington DC"],
  [/\bmclean,?\s*va\b/i, "Washington DC"],
  [/\breston,?\s*va\b/i, "Washington DC"],
  [/\btysons/i, "Washington DC"],

  // Austin
  [/\baustin/i, "Austin"],

  // Denver
  [/\bdenver/i, "Denver"],
  [/\bboulder,?\s*co\b/i, "Denver"],

  // London
  [/\blondon/i, "London"],

  // Atlanta
  [/\batlanta/i, "Atlanta"],

  // Miami
  [/\bmiami/i, "Miami"],
  [/\bfort\s*lauderdale/i, "Miami"],

  // Dallas
  [/\bdallas/i, "Dallas"],
  [/\bfort\s*worth/i, "Dallas"],
  [/\bplano,?\s*tx\b/i, "Dallas"],

  // Philadelphia
  [/\bphiladelphia/i, "Philadelphia"],
  [/\bphilly\b/i, "Philadelphia"],

  // San Diego
  [/\bsan\s*diego/i, "San Diego"],

  // Minneapolis
  [/\bminneapolis/i, "Minneapolis"],

  // Portland
  [/\bportland/i, "Portland"],

  // Salt Lake City
  [/\bsalt\s*lake/i, "Salt Lake City"],

  // Nashville
  [/\bnashville/i, "Nashville"],

  // Charlotte
  [/\bcharlotte/i, "Charlotte"],

  // Toronto
  [/\btoronto/i, "Toronto"],
];

// ─── Normalizer ──────────────────────────────────────────────────

/**
 * Normalizes a raw location string into comma-separated clean city names.
 * Examples:
 *   "New York City, NY"       → "New York"
 *   "NYC / Remote"            → "New York,Remote"
 *   "San Francisco (Hybrid)"  → "San Francisco"
 *   "Remote - US"             → "Remote"
 *   "NYC, SF, or Remote"      → "New York,Remote,San Francisco"
 */
export function normalizeLocation(raw: string | null): string {
  if (!raw || !raw.trim()) return "";

  const lower = raw.toLowerCase().trim();
  const cities = new Set<string>();

  // Detect remote
  if (
    /\b(remote|work\s*from\s*(anywhere|home)|fully\s*remote|100%\s*remote|wfh)\b/i.test(
      lower
    )
  ) {
    cities.add("Remote");
  }

  // Check all matchers against the full string
  for (const [pattern, cityName] of CITY_MATCHERS) {
    if (pattern.test(lower)) {
      cities.add(cityName);
    }
  }

  // If no match found, clean up and use the raw value
  if (cities.size === 0) {
    const cleaned = raw
      .trim()
      .replace(/\s*\(.*?\)\s*/g, "") // Remove parentheticals
      .replace(/\s*[-–]\s*(hybrid|remote|us|usa)\s*/gi, "")
      .replace(/,\s*(united states|us|usa|uk|india|canada)\s*$/i, "")
      .replace(/,\s*[A-Z]{2}\s*$/, "") // Remove trailing state code ", CA"
      .trim();
    if (cleaned) cities.add(cleaned);
  }

  return Array.from(cities).sort().join(",");
}

/**
 * Returns true if the raw location string contains "hybrid".
 */
export function isHybridLocation(raw: string | null): boolean {
  if (!raw) return false;
  return /\bhybrid\b/i.test(raw);
}
