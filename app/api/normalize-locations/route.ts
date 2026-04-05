import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { normalizeLocation } from "@/lib/locations";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  // Fetch all jobs
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("id, location");

  if (error || !jobs) {
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }

  let updated = 0;
  const counts: Record<string, number> = {};

  // Process in batches of 50
  const BATCH = 50;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const promises = batch.map(async (job) => {
      const normalized = normalizeLocation(job.location);
      // Track counts
      for (const city of normalized.split(",").filter(Boolean)) {
        counts[city] = (counts[city] ?? 0) + 1;
      }

      const { error: updateErr } = await supabase
        .from("jobs")
        .update({ normalized_location: normalized })
        .eq("id", job.id);

      if (!updateErr) updated++;
    });
    await Promise.all(promises);
  }

  // Sort locations by count
  const topLocations = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([city, count]) => `${city} (${count})`);

  return NextResponse.json({
    success: true,
    totalJobs: jobs.length,
    normalized: updated,
    topLocations,
  });
}
