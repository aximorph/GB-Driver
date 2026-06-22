-- Normalized daily fuel-price snapshots, one row per (date, station, fuel_type).
--
-- Apply with:
--   cd workers/fuel-cron
--   wrangler d1 migrations apply gbdriver-fuel-history --remote
--
-- (drop --remote to apply to the local dev database instead)

CREATE TABLE IF NOT EXISTS fuel_history (
  date      TEXT NOT NULL,  -- YYYY-MM-DD, Thai local date
  station   TEXT NOT NULL,  -- e.g. 'ptt', 'bcp', 'shell', ...
  fuel_type TEXT NOT NULL,  -- e.g. 'gasohol_95', 'diesel', ...
  price     REAL NOT NULL,
  PRIMARY KEY (date, station, fuel_type)
);

-- Speeds up "give me everything from date >= X" range queries used by the chart.
CREATE INDEX IF NOT EXISTS idx_fuel_history_date ON fuel_history (date);
