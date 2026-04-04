import { Suspense } from "react";
import JobFeed from "@/components/feed/JobFeed";

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto py-8 px-6"><p className="text-gray-500 text-center py-16">Loading...</p></div>}>
      <JobFeed />
    </Suspense>
  );
}
