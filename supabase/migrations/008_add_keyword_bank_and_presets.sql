-- Keyword bank: persistent storage for all keywords ever used
CREATE TABLE IF NOT EXISTS keyword_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  keyword_type text NOT NULL CHECK (keyword_type IN ('title', 'description', 'exclude')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(keyword, keyword_type)
);
ALTER TABLE keyword_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "keyword_bank_all" ON keyword_bank FOR ALL USING (true) WITH CHECK (true);

-- Keyword presets: named combinations of keywords
CREATE TABLE IF NOT EXISTS keyword_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title_keywords text[] DEFAULT '{}',
  description_keywords text[] DEFAULT '{}',
  exclude_keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE keyword_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "keyword_presets_all" ON keyword_presets FOR ALL USING (true) WITH CHECK (true);
