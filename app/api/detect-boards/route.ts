import { NextRequest, NextResponse } from "next/server";

function generateSlugs(name: string, website: string | null): string[] {
  const slugs = new Set<string>();
  const lower = name.toLowerCase();

  // company name: no spaces
  slugs.add(lower.replace(/\s+/g, ""));
  // company name: with hyphens
  slugs.add(lower.replace(/\s+/g, "-"));
  // company name: with underscores
  slugs.add(lower.replace(/\s+/g, "_"));
  // first word only (e.g. "BlueFlame AI" → "blueflame")
  const firstWord = lower.split(/\s+/)[0];
  if (firstWord.length > 2) slugs.add(firstWord);

  // Remove common suffixes like "ai", "io", "inc", "labs", "hq"
  const stripped = lower
    .replace(/\b(ai|io|inc|labs|hq|co|corp|ltd|llc|technologies|tech)\b/gi, "")
    .trim();
  if (stripped && stripped !== lower) {
    slugs.add(stripped.replace(/\s+/g, ""));
    slugs.add(stripped.replace(/\s+/g, "-"));
  }

  // Domain-based slugs from website
  if (website) {
    const domain = website
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split(".")[0];
    if (domain.length > 2) slugs.add(domain.toLowerCase());
  }

  return Array.from(slugs).filter((s) => s.length > 1);
}

async function testGreenhouse(slug: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data?.jobs);
  } catch {
    return false;
  }
}

async function testLever(slug: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${slug}?mode=json&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data);
  } catch {
    return false;
  }
}

async function testAshby(slug: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data?.jobs !== undefined;
  } catch {
    return false;
  }
}

async function scrapeCareerPage(website: string): Promise<{
  greenhouse?: string;
  lever?: string;
  ashby?: string;
}> {
  const results: { greenhouse?: string; lever?: string; ashby?: string } = {};
  const urls = [website.replace(/\/$/, "")];
  // Try /careers and /jobs pages
  urls.push(urls[0] + "/careers", urls[0] + "/jobs");

  for (const url of urls) {
    try {
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      const res = await fetch(fullUrl, {
        signal: AbortSignal.timeout(5000),
        redirect: "follow",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JobSearchBot/1.0)" },
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Look for Greenhouse links
      const ghMatch = html.match(
        /(?:boards\.greenhouse\.io|job-boards\.greenhouse\.io)\/([a-zA-Z0-9_-]+)/
      );
      if (ghMatch && !results.greenhouse) results.greenhouse = ghMatch[1].toLowerCase();

      // Look for Lever links
      const leverMatch = html.match(
        /(?:jobs\.lever\.co|lever\.co)\/([a-zA-Z0-9_-]+)/
      );
      if (leverMatch && !results.lever) results.lever = leverMatch[1].toLowerCase();

      // Look for Ashby links
      const ashbyMatch = html.match(
        /(?:jobs\.ashbyhq\.com|app\.ashbyhq\.com\/posting-api\/job-board)\/([a-zA-Z0-9_-]+)/
      );
      if (ashbyMatch && !results.ashby) results.ashby = ashbyMatch[1].toLowerCase();

      if (results.greenhouse || results.lever || results.ashby) break;
    } catch {
      continue;
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  const { name, website } = await request.json();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slugs = generateSlugs(name, website);
  const detected: { greenhouse: string | null; lever: string | null; ashby: string | null } = {
    greenhouse: null,
    lever: null,
    ashby: null,
  };

  // Test all slug variations against all boards in parallel
  const checks = slugs.flatMap((slug) => [
    testGreenhouse(slug).then((ok) => {
      if (ok && !detected.greenhouse) detected.greenhouse = slug;
    }),
    testLever(slug).then((ok) => {
      if (ok && !detected.lever) detected.lever = slug;
    }),
    testAshby(slug).then((ok) => {
      if (ok && !detected.ashby) detected.ashby = slug;
    }),
  ]);

  await Promise.allSettled(checks);

  // Also try scraping the careers page for direct links
  if (website && (!detected.greenhouse || !detected.lever || !detected.ashby)) {
    const scraped = await scrapeCareerPage(website);
    if (scraped.greenhouse && !detected.greenhouse) {
      // Verify the scraped slug actually works
      if (await testGreenhouse(scraped.greenhouse)) {
        detected.greenhouse = scraped.greenhouse;
      }
    }
    if (scraped.lever && !detected.lever) {
      if (await testLever(scraped.lever)) {
        detected.lever = scraped.lever;
      }
    }
    if (scraped.ashby && !detected.ashby) {
      if (await testAshby(scraped.ashby)) {
        detected.ashby = scraped.ashby;
      }
    }
  }

  return NextResponse.json(detected);
}
