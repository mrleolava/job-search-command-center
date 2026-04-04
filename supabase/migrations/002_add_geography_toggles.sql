-- Add remote/hybrid toggles to search_configs for geography filtering
ALTER TABLE search_configs
  ADD COLUMN IF NOT EXISTS include_remote boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_hybrid boolean DEFAULT true;
