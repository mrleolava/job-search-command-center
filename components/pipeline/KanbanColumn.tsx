"use client";

import { Application, PipelineStage, STAGE_COLORS } from "@/lib/types";
import { capitalize } from "@/lib/utils";
import PipelineCard from "./PipelineCard";

interface KanbanColumnProps {
  stage: PipelineStage;
  applications: Application[];
  onStageChange: (applicationId: string, newStage: PipelineStage) => void;
  onCardClick: (application: Application) => void;
}

export default function KanbanColumn({
  stage,
  applications,
  onStageChange,
  onCardClick,
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] w-[280px]">
      <div className={`${STAGE_COLORS[stage]} text-white px-3 py-2 rounded-t-lg flex items-center justify-between`}>
        <span className="font-medium text-sm">{capitalize(stage)}</span>
        <span className="bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full">
          {applications.length}
        </span>
      </div>
      <div className="bg-gray-100 rounded-b-lg p-2 flex-1 space-y-2 min-h-[200px]">
        {applications.map((app) => (
          <PipelineCard
            key={app.id}
            application={app}
            onStageChange={onStageChange}
            onClick={() => onCardClick(app)}
          />
        ))}
        {applications.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">No applications</p>
        )}
      </div>
    </div>
  );
}
