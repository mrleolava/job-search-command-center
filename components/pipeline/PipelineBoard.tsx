"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { Application, PipelineStage, PIPELINE_STAGES } from "@/lib/types";
import KanbanColumn from "./KanbanColumn";
import ApplicationDetail from "./ApplicationDetail";

export default function PipelineBoard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  async function fetchApplications() {
    const supabase = createClient();
    const { data } = await supabase
      .from("applications")
      .select("*, jobs(*)")
      .order("created_at", { ascending: false });
    if (data) setApplications(data as Application[]);
    setLoading(false);
  }

  const groupedByStage = useMemo(() => {
    const groups: Record<PipelineStage, Application[]> = {
      saved: [],
      applied: [],
      screening: [],
      interviewing: [],
      offer: [],
      rejected: [],
      withdrawn: [],
    };
    for (const app of applications) {
      if (groups[app.stage]) {
        groups[app.stage].push(app);
      }
    }
    return groups;
  }, [applications]);

  async function handleStageChange(applicationId: string, newStage: PipelineStage) {
    // Optimistic update
    setApplications((prev) =>
      prev.map((app) => (app.id === applicationId ? { ...app, stage: newStage } : app))
    );
    if (selectedApp?.id === applicationId) {
      setSelectedApp((prev) => (prev ? { ...prev, stage: newStage } : null));
    }

    const supabase = createClient();
    await supabase.from("applications").update({ stage: newStage }).eq("id", applicationId);
  }

  function handleCardClick(application: Application) {
    setSelectedApp(application);
  }

  function handleDetailUpdate(updated: Application) {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setSelectedApp(updated);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-6">
        <p className="text-claude-tertiary text-center py-16">Loading pipeline...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-claude-primary">Pipeline</h1>
        <span className="text-sm text-claude-tertiary">
          {applications.length} applications
        </span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => (
          <KanbanColumn
            key={stage}
            stage={stage}
            applications={groupedByStage[stage]}
            onStageChange={handleStageChange}
            onCardClick={handleCardClick}
          />
        ))}
      </div>

      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={handleDetailUpdate}
        />
      )}
    </div>
  );
}
