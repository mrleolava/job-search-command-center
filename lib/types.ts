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
  saved: "bg-claude-secondary",
  applied: "bg-claude-accent",
  screening: "bg-amber-500",
  interviewing: "bg-violet-500",
  offer: "bg-emerald-500",
  rejected: "bg-rose-500",
  withdrawn: "bg-claude-tertiary",
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

export interface WatchlistCompany {
  id: string;
  name: string;
  greenhouse_slug: string | null;
  ashby_slug: string | null;
  lever_slug: string | null;
  website: string | null;
  profile_id: string;
  funding_stage: string | null;
  total_raised: string | null;
  total_employees: number | null;
  employee_growth_6m: number | null;
  last_enriched_at: string | null;
  revenue_stage: string | null;
  key_investors: string | null;
  pe_revenue_exposure: string | null;
  glassdoor_rating: number | null;
  glassdoor_url: string | null;
  last_funding_date: string | null;
  last_funding_amount: string | null;
  recent_news: string | null;
  linkedin_url: string | null;
  headquarters: string | null;
  year_founded: number | null;
  ceo_name: string | null;
  cro_name: string | null;
  competitors: string | null;
  tech_stack: string | null;
  company_fit_score: number | null;
}

export const FUNDING_STAGES = [
  "Seed", "Series A", "Series B", "Series C", "Series D+",
  "PE-backed", "Public", "Private/Bootstrapped",
] as const;

export const REVENUE_STAGES = [
  "Pre-revenue", "<$1M ARR", "$1-10M ARR", "$10-50M ARR",
  "$50-100M ARR", "$100M+ ARR",
] as const;

export const PE_EXPOSURE_OPTIONS = [
  "Core (>50%)", "Significant (20-50%)", "Emerging (<20%)", "None/Unknown",
] as const;

export type MatchMode = "AND" | "OR";

export interface SearchConfig {
  id: string;
  profile_id: string;
  title_keywords: string[];
  exclude_keywords: string[];
  locations: string[];
  description_keywords: string[];
  title_match_mode: MatchMode;
  description_match_mode: MatchMode;
  cross_match_mode: MatchMode;
  include_remote: boolean;
  include_hybrid: boolean;
  company_search_enabled: boolean;
}
