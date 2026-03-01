"use client";

import { Application, PipelineStage, PIPELINE_STAGES } from "@/lib/types";
import { daysSince, capitalize, formatSalary } from "@/lib/utils";

interface PipelineCardProps {
  application: Application;
  onStageChange: (applicationId: string, newStage: PipelineStage) => void;
  onClick: () => void;
}

export default function PipelineCard({ application, onStageChange, onClick }: PipelineCardProps) {
  const job = application.jobs;
  const days = daysSince(application.applied_date || application.created_at);

  return (
    <div
      className="bg-white rounded-md border border-gray-200 p-3 cursor-pointer hover:shadow-sm transition-shadow"
      onClick={onClick}
    >
      <div className="text-xs text-gray-500 font-medium">{job?.company ?? "Unknown"}</div>
      <div className="text-sm font-medium text-gray-900 mt-0.5 line-clamp-2">
        {job?.title ?? "Untitled"}
      </div>
      {job && (
        <div className={`text-xs mt-1 ${job.salary_min || job.salary_max ? "text-green-700 font-medium" : "text-gray-400"}`}>
          {formatSalary(job.salary_min, job.salary_max)}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {days !== null ? `${days}d ago` : ""}
        </span>
        {application.next_action && (
          <span className="text-xs text-blue-600 truncate max-w-[120px]">
            {application.next_action}
          </span>
        )}
      </div>
      <select
        value={application.stage}
        onChange={(e) => {
          e.stopPropagation();
          onStageChange(application.id, e.target.value as PipelineStage);
        }}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white"
      >
        {PIPELINE_STAGES.map((s) => (
          <option key={s} value={s}>
            {capitalize(s)}
          </option>
        ))}
        <option value="rejected">Rejected</option>
        <option value="withdrawn">Withdrawn</option>
      </select>
    </div>
  );
}
