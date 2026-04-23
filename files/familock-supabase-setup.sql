-- ════════════════════════════════════════════════════════════════
--  FAMILOCK SUPABASE DATABASE SETUP
--  Wykonaj ten kod w Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Tabela z danymi użytkownika
CREATE TABLE familock_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index dla szybszego dostępu
CREATE INDEX idx_familock_user ON familock_data(user_id);

-- Row Level Security (RLS) - każdy widzi tylko swoje dane
ALTER TABLE familock_data ENABLE ROW LEVEL SECURITY;

-- Polityki RLS
CREATE POLICY "Users can view own data"
  ON familock_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON familock_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON familock_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON familock_data FOR DELETE
  USING (auth.uid() = user_id);

-- Funkcja auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dla auto-update
CREATE TRIGGER familock_updated_at
  BEFORE UPDATE ON familock_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ════════════════════════════════════════════════════════════════
--  GOTOWE!
-- ════════════════════════════════════════════════════════════════

-- Sprawdź czy wszystko działa:
SELECT * FROM familock_data;

-- Powinno być puste (dopóki nie zapiszesz danych z aplikacji)
