export interface Job {
  id: string;
  company: string | null;
  title: string | null;
  url: string | null;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  date_posted: string | null;
  source: string | null;
  description: string | null;
  hiring_manager: string | null;
  recruiter: string | null;
  is_remote: boolean | null;
  job_type: string | null;
  relevance_score: number | null;
  application_count: number | null;
  seniority_score: number | null;
  is_dismissed: boolean;
  created_at: string;
}

export type PipelineStage =
  | "saved"
  | "applied"
  | "screening"
  | "interviewing"
  | "offer"
  | "rejected"
  | "withdrawn";

export const PIPELINE_STAGES: PipelineStage[] = [
  "saved",
  "applied",
  "screening",
  "interviewing",
  "offer",
];

export const STAGE_COLORS: Record<PipelineStage, string> = {
  saved: "bg-gray-500",
  applied: "bg-blue-500",
  screening: "bg-yellow-500",
  interviewing: "bg-purple-500",
  offer: "bg-green-500",
  rejected: "bg-red-500",
  withdrawn: "bg-orange-500",
};

export interface Application {
  id: string;
  job_id: string;
  stage: PipelineStage;
  applied_date: string | null;
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  contacts: string | null;
  source: string | null;
  profile: string;
  created_at: string;
  updated_at: string;
  jobs?: Job;
}

export interface ActivityLogEntry {
  id: string;
  application_id: string;
  from_stage: string | null;
  to_stage: string | null;
  changed_at: string;
}

export interface Profile {
  id: string;
  name: string | null;
  type: string;
}
