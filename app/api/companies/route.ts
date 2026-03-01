import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(request: NextRequest) {
  const { id, companyName } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Delete the watchlist company
  const { error } = await supabase
    .from("watchlist_companies")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also delete jobs from this company
  if (companyName) {
    const { error: jobsError } = await supabase
      .from("jobs")
      .delete()
      .ilike("company", companyName);

    if (jobsError) {
      console.error("Failed to delete jobs for company:", jobsError);
    }
  }

  return NextResponse.json({ success: true });
}
