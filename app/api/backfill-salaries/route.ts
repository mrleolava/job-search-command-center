import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { parseSalary } from "@/lib/scraping";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    // Fetch ALL jobs with descriptions (even those that already have salary data,
    // since the new parser may extract better values)
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select("id, description, salary_min, salary_max")
      .not("description", "is", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let updated = 0;
    let alreadyHad = 0;
    let noSalary = 0;
    let improved = 0;

    for (const job of jobs ?? []) {
      const parsed = parseSalary(job.description);

      if (!parsed.min && !parsed.max) {
        if (job.salary_min || job.salary_max) alreadyHad++;
        else noSalary++;
        continue;
      }

      // Check if we found new or better data
      const hadSalary = job.salary_min || job.salary_max;
      const newMin = parsed.min;
      const newMax = parsed.max;

      // Update if: had no salary, or parser found a higher range (better OTE extraction)
      const shouldUpdate =
        !hadSalary ||
        (newMax && (!job.salary_max || newMax > job.salary_max)) ||
        (newMin && !newMax && !job.salary_min);

      if (shouldUpdate) {
        const update: Record<string, number | null> = {};
        if (newMin) update.salary_min = newMin;
        if (newMax) update.salary_max = newMax;

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

    const totalJobs = jobs?.length ?? 0;
    const noDescription = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .is("description", null);

    return NextResponse.json({
      totalJobs,
      noDescription: noDescription.count ?? 0,
      updated,
      improved,
      alreadyHadSalary: alreadyHad,
      noSalaryFound: noSalary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
