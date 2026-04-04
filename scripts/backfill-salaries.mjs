/**
 * Standalone script to backfill salary data using the improved parser.
 * Run: node scripts/backfill-salaries.mjs
 */

import { createClient } from "@supabase/supabase-js";

const HOURLY_TO_ANNUAL = 2080;

function parseDollarAmount(raw) {
  const s = raw.replace(/[$,\s]/g, "");
  const kMatch = s.match(/^(\d+(?:\.\d+)?)[kK]$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const numMatch = s.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return Math.round(parseFloat(numMatch[1]));
  return null;
}

function toAnnual(value, isHourly) {
  if (isHourly) {
    const annual = value * HOURLY_TO_ANNUAL;
    return annual >= 20000 ? annual : null;
  }
  if (value > 0 && value < 500) {
    const annual = value * HOURLY_TO_ANNUAL;
    return annual >= 20000 ? annual : null;
  }
  return value >= 20000 ? value : null;
}

function extractAllRanges(text) {
  const clean = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");

  const ranges = [];
  const seen = new Set();

  function addRange(min, max) {
    const key = `${min}-${max}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (min || max) ranges.push({ min, max });
  }

  const hourlyContext = /per\s+hour|\/\s*h(?:ou)?r|\bhourlly?\b/i;
  const isHourlyDoc = hourlyContext.test(clean);

  let m;

  const rangeWithDollar = /\$\s*([\d,.]+[kK]?)\s*(?:[-–—]+|to|and)\s*\$\s*([\d,.]+[kK]?)/g;
  while ((m = rangeWithDollar.exec(clean)) !== null) {
    const nearText = clean.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30);
    const isHourly = isHourlyDoc || hourlyContext.test(nearText);
    const v1 = parseDollarAmount(m[1]);
    const v2 = parseDollarAmount(m[2]);
    if (v1 !== null && v2 !== null) {
      const a1 = toAnnual(v1, isHourly);
      const a2 = toAnnual(v2, isHourly);
      if (a1 || a2) addRange(a1, a2);
    }
  }

  const rangeShortK = /\$?\s*(\d+)\s*[-–—]+\s*\$?\s*(\d+)\s*[kK]/g;
  while ((m = rangeShortK.exec(clean)) !== null) {
    const v1 = +m[1], v2 = +m[2];
    if (v1 > 0 && v1 < 1000 && v2 > 0 && v2 < 1000) {
      addRange(v1 * 1000, v2 * 1000);
    }
  }

  const rangeNoDollar = /(?:pay|salary|compensation|range|between)\s*:?\s*([\d,]+)\s*[-–—]+\s*([\d,]+)/gi;
  while ((m = rangeNoDollar.exec(clean)) !== null) {
    const v1 = parseInt(m[1].replace(/,/g, ""), 10);
    const v2 = parseInt(m[2].replace(/,/g, ""), 10);
    if (v1 >= 20000 && v2 >= 20000) addRange(v1, v2);
  }

  const betweenPattern = /between\s+\$\s*([\d,.]+[kK]?)\s+and\s+\$\s*([\d,.]+[kK]?)/gi;
  while ((m = betweenPattern.exec(clean)) !== null) {
    const v1 = parseDollarAmount(m[1]);
    const v2 = parseDollarAmount(m[2]);
    if (v1 !== null && v2 !== null) {
      const a1 = toAnnual(v1, false);
      const a2 = toAnnual(v2, false);
      if (a1 || a2) addRange(a1, a2);
    }
  }

  const hourlyRange = /\$\s*([\d,.]+)\s*[-–—]+\s*\$\s*([\d,.]+)\s*(?:per\s+hour|\/\s*h(?:ou)?r)/gi;
  while ((m = hourlyRange.exec(clean)) !== null) {
    const v1 = parseFloat(m[1].replace(/,/g, ""));
    const v2 = parseFloat(m[2].replace(/,/g, ""));
    if (v1 > 0 && v2 > 0) {
      addRange(Math.round(v1 * HOURLY_TO_ANNUAL), Math.round(v2 * HOURLY_TO_ANNUAL));
    }
  }

  const usdSuffix = /([\d,]+)\s*[-–—]+\s*([\d,]+)\s*USD/gi;
  while ((m = usdSuffix.exec(clean)) !== null) {
    const v1 = parseInt(m[1].replace(/,/g, ""), 10);
    const v2 = parseInt(m[2].replace(/,/g, ""), 10);
    if (v1 >= 20000 && v2 >= 20000) addRange(v1, v2);
  }

  const usdPrefix = /USD\s+\$\s*([\d,.]+[kK]?)\s*[-–—]+\s*\$\s*([\d,.]+[kK]?)/gi;
  while ((m = usdPrefix.exec(clean)) !== null) {
    const v1 = parseDollarAmount(m[1]);
    const v2 = parseDollarAmount(m[2]);
    if (v1 !== null && v2 !== null) {
      const a1 = toAnnual(v1, false);
      const a2 = toAnnual(v2, false);
      if (a1 || a2) addRange(a1, a2);
    }
  }

  const plusPattern = /\$\s*([\d,.]+[kK]?)\s*\+/g;
  while ((m = plusPattern.exec(clean)) !== null) {
    const v = parseDollarAmount(m[1]);
    if (v !== null && v >= 20000) addRange(v, null);
  }

  const singleAnnual = /\$\s*([\d,.]+[kK]?)\s*(?:\/\s*(?:year|yr|annually)|per\s+(?:year|annum)|base|annually|annual)/gi;
  while ((m = singleAnnual.exec(clean)) !== null) {
    const v = parseDollarAmount(m[1]);
    if (v !== null && v >= 20000) addRange(v, null);
  }

  const singleHourly = /\$\s*([\d,.]+)\s*(?:per\s+hour|\/\s*h(?:ou)?r)/gi;
  while ((m = singleHourly.exec(clean)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (v > 0 && v < 500) addRange(Math.round(v * HOURLY_TO_ANNUAL), null);
  }

  if (ranges.length === 0) {
    const ctxPattern = /(?:salary|compensation|pay\s|earning|ote|base|total\s+comp|annual|range|offer)/i;
    if (ctxPattern.test(clean)) {
      const standalone = /\$\s*(\d+)\s*[kK]/g;
      while ((m = standalone.exec(clean)) !== null) {
        const v = +m[1] * 1000;
        if (v >= 20000) addRange(v, null);
      }
    }
  }

  if (ranges.length === 0) {
    const ctxPattern = /(?:salary|compensation|pay\s|earning|ote|base|total\s+comp|annual|range|offer)/i;
    if (ctxPattern.test(clean)) {
      const standaloneNum = /\$\s*([\d,]+(?:\.\d{2})?)\b/g;
      while ((m = standaloneNum.exec(clean)) !== null) {
        const v = parseInt(m[1].replace(/,/g, ""), 10);
        if (v >= 20000) addRange(v, null);
      }
    }
  }

  return ranges;
}

function parseSalary(text) {
  if (!text) return { min: null, max: null };
  const ranges = extractAllRanges(text);
  if (ranges.length === 0) return { min: null, max: null };
  if (ranges.length === 1) return ranges[0];
  const best = ranges.reduce((a, b) => {
    const aMax = a.max ?? a.min ?? 0;
    const bMax = b.max ?? b.min ?? 0;
    return bMax > aMax ? b : a;
  });
  return best;
}

// --- Main ---

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://zwwwwllhqldodpndxprh.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3d3d3bGxocWxkb2RwbmR4cHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzU4MTgsImV4cCI6MjA4Nzg1MTgxOH0.qwt-I54VWVZYbnFgCq9oX8isj0oYck19Nbbz6R4rrB0";

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Fetching all jobs with descriptions...");

// Fetch in batches (Supabase default limit is 1000)
let allJobs = [];
let offset = 0;
const batchSize = 1000;
while (true) {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, description, salary_min, salary_max")
    .not("description", "is", null)
    .range(offset, offset + batchSize - 1);
  if (error) { console.error("Fetch error:", error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  allJobs.push(...data);
  if (data.length < batchSize) break;
  offset += batchSize;
}

console.log(`Found ${allJobs.length} jobs with descriptions.`);

let updated = 0;
let improved = 0;
let alreadyHad = 0;
let noSalary = 0;

for (const job of allJobs) {
  const parsed = parseSalary(job.description);

  if (!parsed.min && !parsed.max) {
    if (job.salary_min || job.salary_max) alreadyHad++;
    else noSalary++;
    continue;
  }

  const hadSalary = job.salary_min || job.salary_max;

  const shouldUpdate =
    !hadSalary ||
    (parsed.max && (!job.salary_max || parsed.max > job.salary_max)) ||
    (parsed.min && !parsed.max && !job.salary_min);

  if (shouldUpdate) {
    const update = {};
    if (parsed.min) update.salary_min = parsed.min;
    if (parsed.max) update.salary_max = parsed.max;

    const { error: updateErr } = await supabase
      .from("jobs")
      .update(update)
      .eq("id", job.id);

    if (!updateErr) {
      if (hadSalary) improved++;
      else updated++;
    }
  } else {
    alreadyHad++;
  }
}

// Count jobs with no description
const { count: noDescCount } = await supabase
  .from("jobs")
  .select("id", { count: "exact", head: true })
  .is("description", null);

// Count total
const { count: totalCount } = await supabase
  .from("jobs")
  .select("id", { count: "exact", head: true });

// Count jobs still with no salary
const { count: noSalaryTotal } = await supabase
  .from("jobs")
  .select("id", { count: "exact", head: true })
  .is("salary_min", null)
  .is("salary_max", null);

console.log("\n=== Backfill Results ===");
console.log(`Total jobs in DB: ${totalCount}`);
console.log(`Jobs with descriptions: ${allJobs.length}`);
console.log(`Jobs without descriptions: ${noDescCount}`);
console.log(`---`);
console.log(`Updated ${updated} jobs with NEW salary data.`);
console.log(`Improved ${improved} jobs with BETTER salary data.`);
console.log(`Already had salary (unchanged): ${alreadyHad}`);
console.log(`Parser found no salary in description: ${noSalary}`);
console.log(`---`);
console.log(`${noSalaryTotal} jobs still have no salary listed.`);
