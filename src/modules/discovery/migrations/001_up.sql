CREATE TABLE IF NOT EXISTS discovery_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  consent BOOLEAN NOT NULL DEFAULT FALSE,
  favorite_colors TEXT[] NOT NULL DEFAULT '{}',
  favorite_themes TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discovery_occasions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(80) NOT NULL,
  kind VARCHAR(24) NOT NULL DEFAULT 'special',
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  day SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 31),
  reminder_days SMALLINT NOT NULL DEFAULT 7 CHECK (reminder_days BETWEEN 0 AND 30),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS discovery_occasions_user_idx ON discovery_occasions(user_id);

CREATE TABLE IF NOT EXISTS discovery_interactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  action VARCHAR(24) NOT NULL CHECK (action IN ('view', 'open_rail', 'save', 'unsave', 'relevant', 'irrelevant', 'theme')),
  theme_key VARCHAR(40),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS discovery_interactions_user_created_idx
  ON discovery_interactions(user_id, created_at DESC);
