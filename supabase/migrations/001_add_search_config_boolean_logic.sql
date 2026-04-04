-- Add description keywords and boolean match modes to search_configs
ALTER TABLE search_configs
  ADD COLUMN IF NOT EXISTS description_keywords text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS title_match_mode text DEFAULT 'OR',
  ADD COLUMN IF NOT EXISTS description_match_mode text DEFAULT 'OR',
  ADD COLUMN IF NOT EXISTS cross_match_mode text DEFAULT 'AND';
