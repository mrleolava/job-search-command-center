ALTER TABLE search_configs
  ADD COLUMN IF NOT EXISTS company_search_enabled boolean DEFAULT true;
