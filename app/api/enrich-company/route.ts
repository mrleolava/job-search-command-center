import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const ENRICHABLE_FIELDS = [
  "funding_stage",
  "total_raised",
  "total_employees",
  "revenue_stage",
  "key_investors",
  "pe_revenue_exposure",
  "glassdoor_rating",
  "glassdoor_url",
  "last_funding_date",
  "last_funding_amount",
  "headquarters",
  "year_founded",
  "ceo_name",
  "cro_name",
  "linkedin_url",
  "competitors",
  "tech_stack",
  "recent_news",
];

type EnrichedData = Record<string, string | number | null>;

// ─── Helpers ─────────────────────────────────────────────────────

function generateSlugs(name: string, website?: string | null): string[] {
  const slugs: string[] = [];
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();

  slugs.push(base.replace(/\s+/g, "-"));
  slugs.push(base.replace(/\s+/g, ""));
  slugs.push(base.replace(/\s+/g, "_"));

  // First word
  const first = base.split(/\s+/)[0];
  if (first.length > 2 && first !== base.replace(/\s+/g, "-")) {
    slugs.push(first);
  }

  // Strip common suffixes
  const stripped = base
    .replace(/\s*(ai|io|inc|co|labs|hq|tech|software|app|global|group)$/i, "")
    .trim();
  if (stripped && stripped !== base) {
    slugs.push(stripped.replace(/\s+/g, "-"));
    slugs.push(stripped.replace(/\s+/g, ""));
  }

  // From domain
  if (website) {
    const domain = website
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    const domainSlug = domain.replace(
      /\.(com|io|ai|co|org|net|dev|app|tech|xyz|us|gg|so|run)$/i,
      ""
    );
    if (domainSlug && !slugs.includes(domainSlug)) {
      slugs.push(domainSlug);
    }
  }

  return Array.from(new Set(slugs));
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSafe(
  url: string,
  timeout = 8000
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(timeout),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Limit to 500KB to avoid memory issues on huge pages
    return text.length > 500_000 ? text.slice(0, 500_000) : text;
  } catch {
    return null;
  }
}

// ─── Source 1: Company Website ───────────────────────────────────

async function enrichFromWebsite(
  website: string
): Promise<EnrichedData> {
  const data: EnrichedData = {};
  const baseUrl = website.startsWith("http") ? website : `https://${website}`;

  for (const path of ["/about", "/about-us", "/company", ""]) {
    const html = await fetchSafe(`${baseUrl}${path}`);
    if (!html) continue;

    const text = stripHtml(html);

    // Employee count
    if (!data.total_employees) {
      const patterns = [
        /(\d[\d,]+)\+?\s*employees/i,
        /team\s+of\s+(\d[\d,]+)/i,
        /(\d[\d,]+)\+?\s*team\s+members/i,
        /(\d[\d,]+)\+?\s*(?:talented\s+)?people\s+(?:work|strong|across|around)/i,
      ];
      for (const pat of patterns) {
        const m = text.match(pat);
        if (m) {
          const n = parseInt(m[1].replace(/,/g, ""));
          if (n >= 5 && n < 500000) {
            data.total_employees = n;
            break;
          }
        }
      }
    }

    // Founded year
    if (!data.year_founded) {
      const m = text.match(
        /(?:founded|established|started|since)\s*(?:in\s+)?(\d{4})/i
      );
      if (m) {
        const y = parseInt(m[1]);
        if (y >= 1900 && y <= 2026) data.year_founded = y;
      }
    }

    // Headquarters
    if (!data.headquarters) {
      const hqPatterns = [
        /(?:headquartered|based|located)\s+in\s+([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})/,
        /(?:headquartered|based)\s+in\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,\s+(?:we|our|the))/,
      ];
      for (const pat of hqPatterns) {
        const m = text.match(pat);
        if (m && m[1].length < 60) {
          data.headquarters = m[1].trim();
          break;
        }
      }
    }

    // Early exit if we found enough
    if (data.total_employees && data.year_founded && data.headquarters) break;
  }

  return data;
}

// ─── Source 2: Crunchbase ────────────────────────────────────────

async function enrichFromCrunchbase(
  name: string,
  website?: string | null
): Promise<EnrichedData> {
  const data: EnrichedData = {};
  const slugs = generateSlugs(name, website);

  for (const slug of slugs) {
    const html = await fetchSafe(
      `https://www.crunchbase.com/organization/${slug}`
    );
    if (!html) continue;

    // og:description often contains a funding summary
    const ogDesc =
      html.match(
        /<meta\s+(?:property|name)="og:description"\s+content="([^"]+)"/i
      )?.[1] ??
      html.match(
        /content="([^"]+)"\s+(?:property|name)="og:description"/i
      )?.[1];

    if (ogDesc) {
      // Total raised — e.g. "raised $150M" or "funding of $2.5 billion"
      if (!data.total_raised) {
        const m = ogDesc.match(
          /(?:raised|funding\s+of)\s+\$?([\d,.]+\s*(?:million|billion|[MBK]))/i
        );
        if (m) {
          let amount = m[1].trim();
          amount = amount.replace(/\s*million/i, "M").replace(/\s*billion/i, "B");
          data.total_raised = `$${amount}`;
        }
      }

      // Employee count
      if (!data.total_employees) {
        const m = ogDesc.match(/(\d[\d,]+)\s*employees/i);
        if (m) data.total_employees = parseInt(m[1].replace(/,/g, ""));
      }

      // Investors
      if (!data.key_investors) {
        const m = ogDesc.match(
          /(?:investors?\s+(?:include|are|:)\s*)([^.]+)/i
        );
        if (m) data.key_investors = m[1].trim().substring(0, 200);
      }
    }

    // JSON-LD structured data
    const ldRegex =
      /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let ldMatch;
    while ((ldMatch = ldRegex.exec(html)) !== null) {
      try {
        const ld = JSON.parse(ldMatch[1]);
        if (ld.foundingDate && !data.year_founded) {
          data.year_founded = parseInt(ld.foundingDate);
        }
        if (ld.address && !data.headquarters) {
          const addr = ld.address;
          if (addr.addressLocality) {
            data.headquarters = [addr.addressLocality, addr.addressRegion]
              .filter(Boolean)
              .join(", ");
          }
        }
        if (ld.numberOfEmployees?.value && !data.total_employees) {
          data.total_employees = parseInt(ld.numberOfEmployees.value);
        }
      } catch {
        // ignore malformed JSON-LD
      }
    }

    // Funding stage from page text
    if (!data.funding_stage) {
      const text = stripHtml(html);
      const m = text.match(
        /(?:Series\s+[A-F]\+?|Seed|Pre-Seed|IPO|Public)/i
      );
      if (m) {
        const s = m[0];
        if (/seed/i.test(s)) data.funding_stage = "Seed";
        else if (/Series\s+A/i.test(s)) data.funding_stage = "Series A";
        else if (/Series\s+B/i.test(s)) data.funding_stage = "Series B";
        else if (/Series\s+C/i.test(s)) data.funding_stage = "Series C";
        else if (/Series\s+[D-F]/i.test(s)) data.funding_stage = "Series D+";
        else if (/Public|IPO/i.test(s)) data.funding_stage = "Public";
      }
    }

    if (Object.keys(data).length > 0) break; // found data, stop
  }

  return data;
}

// ─── Source 3: LinkedIn URL ──────────────────────────────────────

function enrichLinkedIn(
  name: string,
  website?: string | null
): EnrichedData {
  let slug: string;
  if (website) {
    slug = website
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .replace(/\.(com|io|ai|co|org|net|dev|app|tech|xyz|us|gg|so|run)$/i, "");
  } else {
    slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  return { linkedin_url: `https://www.linkedin.com/company/${slug}` };
}

// ─── Source 4: Glassdoor via DuckDuckGo ──────────────────────────

async function enrichGlassdoor(
  name: string
): Promise<EnrichedData> {
  const data: EnrichedData = {};

  const query = encodeURIComponent(`site:glassdoor.com "${name}" reviews`);
  const html = await fetchSafe(
    `https://html.duckduckgo.com/html/?q=${query}`,
    10000
  );

  if (html) {
    // Extract Glassdoor URL
    const urlMatch = html.match(
      /https?:\/\/(?:www\.)?glassdoor\.com\/Overview\/[^\s"<&]+/i
    );
    if (urlMatch) {
      data.glassdoor_url = urlMatch[0].replace(/&amp;/g, "&");
    }

    // Rating from snippet text
    const ratingMatch = html.match(
      /(\d\.\d)\s*(?:★|star|rating|\/ *5)/i
    );
    if (ratingMatch) {
      const r = parseFloat(ratingMatch[1]);
      if (r >= 1.0 && r <= 5.0) data.glassdoor_rating = r;
    }
  }

  return data;
}

// ─── Main Handler ────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId required" },
        { status: 400 }
      );
    }

    // Fetch company
    const { data: company, error } = await supabase
      .from("watchlist_companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error || !company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const manualFields = new Set<string>(
      company.manually_edited_fields ?? []
    );

    // Run sources in parallel
    const [websiteData, crunchbaseData, glassdoorData] = await Promise.all([
      company.website
        ? enrichFromWebsite(company.website)
        : Promise.resolve({} as EnrichedData),
      enrichFromCrunchbase(company.name, company.website),
      enrichGlassdoor(company.name),
    ]);
    const linkedinData = enrichLinkedIn(company.name, company.website);

    // Merge results: only fill empty, non-manual fields
    const merged: EnrichedData = {};
    const sources: string[] = [];

    const mergeSource = (source: string, srcData: EnrichedData) => {
      let contributed = false;
      for (const [field, value] of Object.entries(srcData)) {
        if (value == null || value === "") continue;
        if (manualFields.has(field)) continue;
        if (company[field] != null && company[field] !== "") continue;
        if (merged[field] != null) continue; // already found
        merged[field] = value;
        contributed = true;
      }
      if (contributed) sources.push(source);
    };

    // Priority: crunchbase > website > linkedin > glassdoor
    mergeSource("crunchbase", crunchbaseData);
    mergeSource("website", websiteData);
    mergeSource("linkedin", linkedinData);
    mergeSource("glassdoor", glassdoorData);

    // Save to database
    const foundFields = Object.keys(merged);
    if (foundFields.length > 0) {
      const updatePayload = { ...merged, last_enriched_at: new Date().toISOString() };
      const { error: updateError } = await supabase
        .from("watchlist_companies")
        .update(updatePayload)
        .eq("id", companyId);

      if (updateError) {
        console.error("Enrichment update failed:", updateError);
        return NextResponse.json(
          { error: "Failed to save enrichment data" },
          { status: 500 }
        );
      }
    } else {
      // Still update last_enriched_at
      await supabase
        .from("watchlist_companies")
        .update({ last_enriched_at: new Date().toISOString() })
        .eq("id", companyId);
    }

    // Missing fields
    const missing = ENRICHABLE_FIELDS.filter(
      (f) => !merged[f] && (company[f] == null || company[f] === "")
    );

    return NextResponse.json({
      success: true,
      found: merged,
      foundFields,
      missing,
      sources,
    });
  } catch (err) {
    console.error("Enrichment error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
