ALTER TABLE watchlist_companies ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
