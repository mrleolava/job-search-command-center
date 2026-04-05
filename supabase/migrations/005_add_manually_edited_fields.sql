ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS manually_edited_fields text[] DEFAULT '{}';
