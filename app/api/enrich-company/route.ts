import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { lookupCompanyData } from "@/lib/company-data";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Web scraping fallback helpers ──────────────────────────────

async function fetchSafe(
  url: string,
  timeout = 8000
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(timeout),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 500_000 ? text.slice(0, 500_000) : text;
  } catch {
    return null;
  }
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

async function scrapeWebsiteFallback(
  website: string
): Promise<EnrichedData> {
  const data: EnrichedData = {};
  const baseUrl = website.startsWith("http") ? website : `https://${website}`;

  for (const path of ["/about", "/about-us", "/company", ""]) {
    const html = await fetchSafe(`${baseUrl}${path}`);
    if (!html) continue;
    const text = stripHtml(html);

    if (!data.total_employees) {
      const patterns = [
        /(\d[\d,]+)\+?\s*employees/i,
        /team\s+of\s+(\d[\d,]+)/i,
        /(\d[\d,]+)\+?\s*team\s+members/i,
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

    if (!data.year_founded) {
      const m = text.match(
        /(?:founded|established|started|since)\s*(?:in\s+)?(\d{4})/i
      );
      if (m) {
        const y = parseInt(m[1]);
        if (y >= 1900 && y <= 2026) data.year_founded = y;
      }
    }

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

    if (data.total_employees && data.year_founded && data.headquarters) break;
  }

  // Generate linkedin URL from domain
  if (!data.linkedin_url && website) {
    const slug = website
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .replace(
        /\.(com|io|ai|co|org|net|dev|app|tech|xyz|us|gg|so|run)$/i,
        ""
      );
    data.linkedin_url = `https://www.linkedin.com/company/${slug}`;
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

    // ── Source 1: Static lookup (fast + reliable) ──
    const staticData = lookupCompanyData(company.name, company.website);

    // ── Source 2: Website scraping fallback ──
    let scraped: EnrichedData = {};
    if (!staticData && company.website) {
      scraped = await scrapeWebsiteFallback(company.website);
    }

    // Merge: static first, then scraped fallback
    const merged: EnrichedData = {};
    const sources: string[] = [];

    const mergeSource = (source: string, srcData: EnrichedData) => {
      let contributed = false;
      for (const [field, value] of Object.entries(srcData)) {
        if (value == null || value === "") continue;
        if (manualFields.has(field)) continue;
        if (company[field] != null && company[field] !== "") continue;
        if (merged[field] != null) continue;
        merged[field] = value;
        contributed = true;
      }
      if (contributed) sources.push(source);
    };

    if (staticData) {
      mergeSource("static-lookup", staticData as unknown as EnrichedData);
    }
    if (Object.keys(scraped).length > 0) {
      mergeSource("website-scrape", scraped);
    }

    // Save to database
    const foundFields = Object.keys(merged);
    if (foundFields.length > 0) {
      const updatePayload = {
        ...merged,
        last_enriched_at: new Date().toISOString(),
      };
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
      await supabase
        .from("watchlist_companies")
        .update({ last_enriched_at: new Date().toISOString() })
        .eq("id", companyId);
    }

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
