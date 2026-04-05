import { Suspense } from "react";
import JobFeed from "@/components/feed/JobFeed";

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto py-8 px-6"><p className="text-claude-tertiary text-center py-16">Loading...</p></div>}>
      <JobFeed />
    </Suspense>
  );
}
