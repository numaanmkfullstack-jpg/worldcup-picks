-- FIFA World Cup prediction app schema for Neon/Postgres.
-- Run this whole file in the Neon SQL Editor.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  CREATE TYPE org_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE match_stage AS ENUM (
    'group',
    'round_of_32',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'third_place',
    'final'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE match_status AS ENUM (
    'scheduled',
    'live',
    'full_time',
    'postponed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE result_source AS ENUM ('manual', 'api');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  display_name text NOT NULL,
  avatar_url text,
  auth_provider text,
  external_auth_id text,
  password_hash text,
  password_set_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT false,
  invited_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, external_auth_id)
);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug citext NOT NULL UNIQUE,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  created_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  prediction_lock_minutes_before_kickoff integer NOT NULL DEFAULT 0 CHECK (prediction_lock_minutes_before_kickoff >= 0),
  points_correct_outcome integer NOT NULL DEFAULT 1 CHECK (points_correct_outcome >= 0),
  points_exact_score integer NOT NULL DEFAULT 3 CHECK (points_exact_score >= points_correct_outcome),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fifa_code text UNIQUE,
  name text NOT NULL UNIQUE,
  short_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  city text,
  country text,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_order integer NOT NULL UNIQUE CHECK (schedule_order BETWEEN 1 AND 104),
  fifa_match_number integer CHECK (fifa_match_number BETWEEN 1 AND 104),
  stage match_stage NOT NULL,
  group_code text CHECK (group_code IS NULL OR group_code ~ '^[A-L]$'),
  kickoff_at timestamptz,
  kickoff_local_date date NOT NULL,
  home_team_id uuid REFERENCES teams(id) ON DELETE RESTRICT,
  away_team_id uuid REFERENCES teams(id) ON DELETE RESTRICT,
  home_placeholder text,
  away_placeholder text,
  venue_id uuid REFERENCES venues(id) ON DELETE RESTRICT,
  status match_status NOT NULL DEFAULT 'scheduled',
  home_score integer CHECK (home_score IS NULL OR home_score >= 0),
  away_score integer CHECK (away_score IS NULL OR away_score >= 0),
  winner_team_id uuid REFERENCES teams(id) ON DELETE RESTRICT,
  result_source result_source,
  result_confirmed_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  result_confirmed_at timestamptz,
  predictions_locked_at timestamptz,
  predictions_locked_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  predictions_lock_reason text,
  source_url text NOT NULL,
  source_last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((home_score IS NULL AND away_score IS NULL) OR (home_score IS NOT NULL AND away_score IS NOT NULL)),
  CHECK (stage <> 'group' OR group_code IS NOT NULL),
  CHECK (stage = 'group' OR group_code IS NULL),
  CHECK (home_team_id IS NOT NULL OR home_placeholder IS NOT NULL),
  CHECK (away_team_id IS NOT NULL OR away_placeholder IS NOT NULL),
  CHECK (home_team_id IS NULL OR away_team_id IS NULL OR home_team_id <> away_team_id),
  CHECK (winner_team_id IS NULL OR winner_team_id IN (home_team_id, away_team_id)),
  CHECK (
    (predictions_locked_at IS NULL AND predictions_locked_by_user_id IS NULL AND predictions_lock_reason IS NULL)
    OR (predictions_locked_at IS NOT NULL AND predictions_lock_reason IS NOT NULL)
  )
);

ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS predictions_locked_at timestamptz;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS predictions_locked_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS predictions_lock_reason text;
ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_predictions_lock_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_predictions_lock_check
  CHECK (
    (predictions_locked_at IS NULL AND predictions_locked_by_user_id IS NULL AND predictions_lock_reason IS NULL)
    OR (predictions_locked_at IS NOT NULL AND predictions_lock_reason IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS tournament_matches_fifa_match_number_idx
  ON tournament_matches(fifa_match_number)
  WHERE fifa_match_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  predicted_home_score integer NOT NULL CHECK (predicted_home_score >= 0),
  predicted_away_score integer NOT NULL CHECK (predicted_away_score >= 0),
  locked_at timestamptz,
  lock_reason text CHECK (lock_reason IS NULL OR lock_reason IN ('user', 'kickoff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((locked_at IS NULL AND lock_reason IS NULL) OR (locked_at IS NOT NULL AND lock_reason IS NOT NULL)),
  UNIQUE (organization_id, user_id, match_id)
);

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS lock_reason text;
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_lock_reason_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_lock_reason_check
  CHECK (lock_reason IS NULL OR lock_reason IN ('user', 'kickoff'));
ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_locked_pair_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_locked_pair_check
  CHECK ((locked_at IS NULL AND lock_reason IS NULL) OR (locked_at IS NOT NULL AND lock_reason IS NOT NULL));

CREATE TABLE IF NOT EXISTS result_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_request_id text,
  status text NOT NULL DEFAULT 'started',
  matches_checked integer NOT NULL DEFAULT 0 CHECK (matches_checked >= 0),
  matches_updated integer NOT NULL DEFAULT 0 CHECK (matches_updated >= 0),
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_users_set_updated_at ON app_users;
CREATE TRIGGER app_users_set_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tournament_matches_set_updated_at ON tournament_matches;
CREATE TRIGGER tournament_matches_set_updated_at
BEFORE UPDATE ON tournament_matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS predictions_set_updated_at ON predictions;
CREATE TRIGGER predictions_set_updated_at
BEFORE UPDATE ON predictions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION assert_prediction_allowed()
RETURNS trigger AS $$
DECLARE
  match_kickoff timestamptz;
  match_status match_status;
  match_predictions_locked_at timestamptz;
  lock_minutes integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = NEW.organization_id
      AND om.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'user must be a member of the organization to predict';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'this prediction is locked and cannot be changed';
  END IF;

  SELECT tm.kickoff_at, tm.status, tm.predictions_locked_at, o.prediction_lock_minutes_before_kickoff
  INTO match_kickoff, match_status, match_predictions_locked_at, lock_minutes
  FROM tournament_matches tm
  JOIN organizations o ON o.id = NEW.organization_id
  WHERE tm.id = NEW.match_id;

  IF match_predictions_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'predictions are locked for this match by an admin';
  END IF;

  IF match_status IN ('live', 'full_time', 'cancelled') THEN
    RAISE EXCEPTION 'predictions are closed for this match';
  END IF;

  IF match_kickoff IS NOT NULL AND now() >= match_kickoff - make_interval(mins => lock_minutes) THEN
    RAISE EXCEPTION 'predictions are locked for this match';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS predictions_assert_allowed ON predictions;
CREATE TRIGGER predictions_assert_allowed
BEFORE INSERT OR UPDATE OF predicted_home_score, predicted_away_score, locked_at, lock_reason, match_id, organization_id, user_id ON predictions
FOR EACH ROW EXECUTE FUNCTION assert_prediction_allowed();

DROP VIEW IF EXISTS organization_leaderboard;
DROP VIEW IF EXISTS prediction_scores;

CREATE OR REPLACE VIEW prediction_scores AS
SELECT
  p.id AS prediction_id,
  p.organization_id,
  p.user_id,
  p.match_id,
  tm.schedule_order,
  tm.fifa_match_number,
  tm.stage,
  tm.group_code,
  tm.kickoff_at,
  tm.kickoff_local_date,
  p.predicted_home_score,
  p.predicted_away_score,
  p.locked_at,
  p.lock_reason,
  p.updated_at AS prediction_updated_at,
  tm.home_score,
  tm.away_score,
  CASE
    WHEN p.predicted_home_score > p.predicted_away_score THEN 'home'
    WHEN p.predicted_home_score < p.predicted_away_score THEN 'away'
    ELSE 'draw'
  END AS predicted_outcome,
  CASE
    WHEN tm.home_score IS NULL OR tm.away_score IS NULL THEN NULL
    WHEN tm.home_score > tm.away_score THEN 'home'
    WHEN tm.home_score < tm.away_score THEN 'away'
    ELSE 'draw'
  END AS actual_outcome,
  (
    tm.home_score IS NOT NULL
    AND tm.away_score IS NOT NULL
    AND p.predicted_home_score = tm.home_score
    AND p.predicted_away_score = tm.away_score
  ) AS is_exact_score,
  (
    tm.home_score IS NOT NULL
    AND tm.away_score IS NOT NULL
    AND (
      CASE
        WHEN p.predicted_home_score > p.predicted_away_score THEN 'home'
        WHEN p.predicted_home_score < p.predicted_away_score THEN 'away'
        ELSE 'draw'
      END
    ) = (
      CASE
        WHEN tm.home_score > tm.away_score THEN 'home'
        WHEN tm.home_score < tm.away_score THEN 'away'
        ELSE 'draw'
      END
    )
  ) AS is_correct_outcome,
  CASE
    WHEN tm.status <> 'full_time' OR tm.home_score IS NULL OR tm.away_score IS NULL THEN 0
    WHEN p.predicted_home_score = tm.home_score AND p.predicted_away_score = tm.away_score THEN o.points_exact_score
    WHEN (
      CASE
        WHEN p.predicted_home_score > p.predicted_away_score THEN 'home'
        WHEN p.predicted_home_score < p.predicted_away_score THEN 'away'
        ELSE 'draw'
      END
    ) = (
      CASE
        WHEN tm.home_score > tm.away_score THEN 'home'
        WHEN tm.home_score < tm.away_score THEN 'away'
        ELSE 'draw'
      END
    ) THEN o.points_correct_outcome
    ELSE 0
  END AS points_awarded
FROM predictions p
JOIN organizations o ON o.id = p.organization_id
JOIN tournament_matches tm ON tm.id = p.match_id;

CREATE OR REPLACE VIEW organization_leaderboard AS
WITH totals AS (
  SELECT
    om.organization_id,
    om.user_id,
    u.display_name,
    u.avatar_url,
    COALESCE(SUM(ps.points_awarded), 0)::integer AS total_points,
    COUNT(ps.prediction_id)::integer AS predictions_made,
    COUNT(*) FILTER (WHERE ps.home_score IS NOT NULL AND ps.away_score IS NOT NULL)::integer AS predictions_scored,
    COUNT(*) FILTER (WHERE ps.is_exact_score)::integer AS exact_scores,
    COUNT(*) FILTER (WHERE ps.is_correct_outcome)::integer AS correct_outcomes,
    MAX(ps.prediction_updated_at) AS last_prediction_at
  FROM organization_members om
  JOIN app_users u ON u.id = om.user_id
  LEFT JOIN prediction_scores ps
    ON ps.organization_id = om.organization_id
   AND ps.user_id = om.user_id
  GROUP BY om.organization_id, om.user_id, u.display_name, u.avatar_url
)
SELECT
  DENSE_RANK() OVER (
    PARTITION BY organization_id
    ORDER BY total_points DESC, exact_scores DESC, correct_outcomes DESC, predictions_scored ASC, display_name ASC
  )::integer AS rank,
  organization_id,
  user_id,
  display_name,
  avatar_url,
  total_points,
  predictions_made,
  predictions_scored,
  exact_scores,
  correct_outcomes,
  last_prediction_at
FROM totals;

CREATE INDEX IF NOT EXISTS organization_members_user_id_idx ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS tournament_matches_stage_date_idx ON tournament_matches(stage, kickoff_local_date, schedule_order);
CREATE INDEX IF NOT EXISTS tournament_matches_venue_id_idx ON tournament_matches(venue_id);
CREATE INDEX IF NOT EXISTS predictions_user_id_idx ON predictions(user_id);
CREATE INDEX IF NOT EXISTS predictions_match_id_idx ON predictions(match_id);
CREATE INDEX IF NOT EXISTS predictions_org_match_idx ON predictions(organization_id, match_id);

INSERT INTO teams (fifa_code, name, short_name)
VALUES
  ('ALG', 'Algeria', 'Algeria'),
  ('ARG', 'Argentina', 'Argentina'),
  ('AUS', 'Australia', 'Australia'),
  ('AUT', 'Austria', 'Austria'),
  ('BEL', 'Belgium', 'Belgium'),
  ('BIH', 'Bosnia and Herzegovina', 'Bosnia and Herzegovina'),
  ('BRA', 'Brazil', 'Brazil'),
  ('CAN', 'Canada', 'Canada'),
  ('CPV', 'Cabo Verde', 'Cabo Verde'),
  ('COD', 'Congo DR', 'Congo DR'),
  ('CIV', 'Côte d''Ivoire', 'Côte d''Ivoire'),
  ('CRO', 'Croatia', 'Croatia'),
  ('CUW', 'Curaçao', 'Curaçao'),
  ('CZE', 'Czechia', 'Czechia'),
  ('ECU', 'Ecuador', 'Ecuador'),
  ('EGY', 'Egypt', 'Egypt'),
  ('ENG', 'England', 'England'),
  ('FRA', 'France', 'France'),
  ('GER', 'Germany', 'Germany'),
  ('GHA', 'Ghana', 'Ghana'),
  ('HAI', 'Haiti', 'Haiti'),
  ('IRN', 'IR Iran', 'IR Iran'),
  ('IRQ', 'Iraq', 'Iraq'),
  ('JPN', 'Japan', 'Japan'),
  ('JOR', 'Jordan', 'Jordan'),
  ('KOR', 'Korea Republic', 'Korea Republic'),
  ('MAR', 'Morocco', 'Morocco'),
  ('MEX', 'Mexico', 'Mexico'),
  ('NED', 'Netherlands', 'Netherlands'),
  ('NZL', 'New Zealand', 'New Zealand'),
  ('NOR', 'Norway', 'Norway'),
  ('PAN', 'Panama', 'Panama'),
  ('PAR', 'Paraguay', 'Paraguay'),
  ('POR', 'Portugal', 'Portugal'),
  ('QAT', 'Qatar', 'Qatar'),
  ('KSA', 'Saudi Arabia', 'Saudi Arabia'),
  ('SCO', 'Scotland', 'Scotland'),
  ('SEN', 'Senegal', 'Senegal'),
  ('RSA', 'South Africa', 'South Africa'),
  ('ESP', 'Spain', 'Spain'),
  ('SUI', 'Switzerland', 'Switzerland'),
  ('SWE', 'Sweden', 'Sweden'),
  ('TUN', 'Tunisia', 'Tunisia'),
  ('TUR', 'Türkiye', 'Türkiye'),
  ('URU', 'Uruguay', 'Uruguay'),
  ('USA', 'USA', 'USA'),
  ('UZB', 'Uzbekistan', 'Uzbekistan')
ON CONFLICT (name) DO UPDATE
SET fifa_code = EXCLUDED.fifa_code,
    short_name = EXCLUDED.short_name;

INSERT INTO venues (name, city, country, timezone)
VALUES
  ('Atlanta Stadium', 'Atlanta', 'USA', 'America/New_York'),
  ('BC Place Vancouver', 'Vancouver', 'Canada', 'America/Vancouver'),
  ('Boston Stadium', 'Boston', 'USA', 'America/New_York'),
  ('Dallas Stadium', 'Dallas', 'USA', 'America/Chicago'),
  ('Estadio Guadalajara', 'Guadalajara', 'Mexico', 'America/Mexico_City'),
  ('Estadio Monterrey', 'Monterrey', 'Mexico', 'America/Monterrey'),
  ('Houston Stadium', 'Houston', 'USA', 'America/Chicago'),
  ('Kansas City Stadium', 'Kansas City', 'USA', 'America/Chicago'),
  ('Los Angeles Stadium', 'Los Angeles', 'USA', 'America/Los_Angeles'),
  ('Mexico City Stadium', 'Mexico City', 'Mexico', 'America/Mexico_City'),
  ('Miami Stadium', 'Miami', 'USA', 'America/New_York'),
  ('New York New Jersey Stadium', 'New York New Jersey', 'USA', 'America/New_York'),
  ('Philadelphia Stadium', 'Philadelphia', 'USA', 'America/New_York'),
  ('San Francisco Bay Area Stadium', 'San Francisco Bay Area', 'USA', 'America/Los_Angeles'),
  ('Seattle Stadium', 'Seattle', 'USA', 'America/Los_Angeles'),
  ('Toronto Stadium', 'Toronto', 'Canada', 'America/Toronto')
ON CONFLICT (name) DO UPDATE
SET city = EXCLUDED.city,
    country = EXCLUDED.country,
    timezone = EXCLUDED.timezone;

WITH group_seed(schedule_order, kickoff_local_date, group_code, home_name, away_name, venue_name) AS (
  VALUES
    (1, DATE '2026-06-11', 'A', 'Mexico', 'South Africa', 'Mexico City Stadium'),
    (2, DATE '2026-06-11', 'A', 'Korea Republic', 'Czechia', 'Estadio Guadalajara'),
    (3, DATE '2026-06-12', 'B', 'Canada', 'Bosnia and Herzegovina', 'Toronto Stadium'),
    (4, DATE '2026-06-12', 'D', 'USA', 'Paraguay', 'Los Angeles Stadium'),
    (5, DATE '2026-06-13', 'C', 'Haiti', 'Scotland', 'Boston Stadium'),
    (6, DATE '2026-06-13', 'D', 'Australia', 'Türkiye', 'BC Place Vancouver'),
    (7, DATE '2026-06-13', 'C', 'Brazil', 'Morocco', 'New York New Jersey Stadium'),
    (8, DATE '2026-06-13', 'B', 'Qatar', 'Switzerland', 'San Francisco Bay Area Stadium'),
    (9, DATE '2026-06-14', 'E', 'Côte d''Ivoire', 'Ecuador', 'Philadelphia Stadium'),
    (10, DATE '2026-06-14', 'E', 'Germany', 'Curaçao', 'Houston Stadium'),
    (11, DATE '2026-06-14', 'F', 'Netherlands', 'Japan', 'Dallas Stadium'),
    (12, DATE '2026-06-14', 'F', 'Sweden', 'Tunisia', 'Estadio Monterrey'),
    (13, DATE '2026-06-15', 'H', 'Saudi Arabia', 'Uruguay', 'Miami Stadium'),
    (14, DATE '2026-06-15', 'H', 'Spain', 'Cabo Verde', 'Atlanta Stadium'),
    (15, DATE '2026-06-15', 'G', 'IR Iran', 'New Zealand', 'Los Angeles Stadium'),
    (16, DATE '2026-06-15', 'G', 'Belgium', 'Egypt', 'Seattle Stadium'),
    (17, DATE '2026-06-16', 'I', 'France', 'Senegal', 'New York New Jersey Stadium'),
    (18, DATE '2026-06-16', 'I', 'Iraq', 'Norway', 'Boston Stadium'),
    (19, DATE '2026-06-16', 'J', 'Argentina', 'Algeria', 'Kansas City Stadium'),
    (20, DATE '2026-06-16', 'J', 'Austria', 'Jordan', 'San Francisco Bay Area Stadium'),
    (21, DATE '2026-06-17', 'L', 'Ghana', 'Panama', 'Toronto Stadium'),
    (22, DATE '2026-06-17', 'L', 'England', 'Croatia', 'Dallas Stadium'),
    (23, DATE '2026-06-17', 'K', 'Portugal', 'Congo DR', 'Houston Stadium'),
    (24, DATE '2026-06-17', 'K', 'Uzbekistan', 'Colombia', 'Mexico City Stadium'),
    (25, DATE '2026-06-18', 'A', 'Czechia', 'South Africa', 'Atlanta Stadium'),
    (26, DATE '2026-06-18', 'B', 'Switzerland', 'Bosnia and Herzegovina', 'Los Angeles Stadium'),
    (27, DATE '2026-06-18', 'B', 'Canada', 'Qatar', 'BC Place Vancouver'),
    (28, DATE '2026-06-18', 'A', 'Mexico', 'Korea Republic', 'Estadio Guadalajara'),
    (29, DATE '2026-06-19', 'C', 'Brazil', 'Haiti', 'Philadelphia Stadium'),
    (30, DATE '2026-06-19', 'C', 'Scotland', 'Morocco', 'Boston Stadium'),
    (31, DATE '2026-06-19', 'D', 'Türkiye', 'Paraguay', 'San Francisco Bay Area Stadium'),
    (32, DATE '2026-06-19', 'D', 'USA', 'Australia', 'Seattle Stadium'),
    (33, DATE '2026-06-20', 'E', 'Germany', 'Côte d''Ivoire', 'Toronto Stadium'),
    (34, DATE '2026-06-20', 'E', 'Ecuador', 'Curaçao', 'Kansas City Stadium'),
    (35, DATE '2026-06-20', 'F', 'Netherlands', 'Sweden', 'Houston Stadium'),
    (36, DATE '2026-06-20', 'F', 'Tunisia', 'Japan', 'Estadio Monterrey'),
    (37, DATE '2026-06-21', 'H', 'Uruguay', 'Cabo Verde', 'Miami Stadium'),
    (38, DATE '2026-06-21', 'H', 'Spain', 'Saudi Arabia', 'Atlanta Stadium'),
    (39, DATE '2026-06-21', 'G', 'Belgium', 'IR Iran', 'Los Angeles Stadium'),
    (40, DATE '2026-06-21', 'G', 'New Zealand', 'Egypt', 'BC Place Vancouver'),
    (41, DATE '2026-06-22', 'I', 'Norway', 'Senegal', 'New York New Jersey Stadium'),
    (42, DATE '2026-06-22', 'I', 'France', 'Iraq', 'Philadelphia Stadium'),
    (43, DATE '2026-06-22', 'J', 'Argentina', 'Austria', 'Dallas Stadium'),
    (44, DATE '2026-06-22', 'J', 'Jordan', 'Algeria', 'San Francisco Bay Area Stadium'),
    (45, DATE '2026-06-23', 'L', 'England', 'Ghana', 'Boston Stadium'),
    (46, DATE '2026-06-23', 'L', 'Panama', 'Croatia', 'Toronto Stadium'),
    (47, DATE '2026-06-23', 'K', 'Portugal', 'Uzbekistan', 'Houston Stadium'),
    (48, DATE '2026-06-23', 'K', 'Colombia', 'Congo DR', 'Estadio Guadalajara'),
    (49, DATE '2026-06-24', 'C', 'Scotland', 'Brazil', 'Miami Stadium'),
    (50, DATE '2026-06-24', 'C', 'Morocco', 'Haiti', 'Atlanta Stadium'),
    (51, DATE '2026-06-24', 'B', 'Switzerland', 'Canada', 'BC Place Vancouver'),
    (52, DATE '2026-06-24', 'B', 'Bosnia and Herzegovina', 'Qatar', 'Seattle Stadium'),
    (53, DATE '2026-06-24', 'A', 'Czechia', 'Mexico', 'Mexico City Stadium'),
    (54, DATE '2026-06-24', 'A', 'South Africa', 'Korea Republic', 'Estadio Monterrey'),
    (55, DATE '2026-06-25', 'E', 'Curaçao', 'Côte d''Ivoire', 'Philadelphia Stadium'),
    (56, DATE '2026-06-25', 'E', 'Ecuador', 'Germany', 'New York New Jersey Stadium'),
    (57, DATE '2026-06-25', 'F', 'Japan', 'Sweden', 'Dallas Stadium'),
    (58, DATE '2026-06-25', 'F', 'Tunisia', 'Netherlands', 'Kansas City Stadium'),
    (59, DATE '2026-06-25', 'D', 'Türkiye', 'USA', 'Los Angeles Stadium'),
    (60, DATE '2026-06-25', 'D', 'Paraguay', 'Australia', 'San Francisco Bay Area Stadium'),
    (61, DATE '2026-06-26', 'I', 'Norway', 'France', 'Boston Stadium'),
    (62, DATE '2026-06-26', 'I', 'Senegal', 'Iraq', 'Toronto Stadium'),
    (63, DATE '2026-06-26', 'G', 'Egypt', 'IR Iran', 'Seattle Stadium'),
    (64, DATE '2026-06-26', 'G', 'New Zealand', 'Belgium', 'BC Place Vancouver'),
    (65, DATE '2026-06-26', 'H', 'Cabo Verde', 'Saudi Arabia', 'Houston Stadium'),
    (66, DATE '2026-06-26', 'H', 'Uruguay', 'Spain', 'Estadio Guadalajara'),
    (67, DATE '2026-06-27', 'L', 'Panama', 'England', 'New York New Jersey Stadium'),
    (68, DATE '2026-06-27', 'L', 'Croatia', 'Ghana', 'Philadelphia Stadium'),
    (69, DATE '2026-06-27', 'J', 'Algeria', 'Austria', 'Kansas City Stadium'),
    (70, DATE '2026-06-27', 'J', 'Jordan', 'Argentina', 'Dallas Stadium'),
    (71, DATE '2026-06-27', 'K', 'Colombia', 'Portugal', 'Miami Stadium'),
    (72, DATE '2026-06-27', 'K', 'Congo DR', 'Uzbekistan', 'Atlanta Stadium')
)
INSERT INTO tournament_matches (
  schedule_order,
  fifa_match_number,
  stage,
  group_code,
  kickoff_local_date,
  home_team_id,
  away_team_id,
  venue_id,
  source_url
)
SELECT
  gs.schedule_order,
  NULL,
  'group'::match_stage,
  gs.group_code,
  gs.kickoff_local_date,
  ht.id,
  at.id,
  v.id,
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums'
FROM group_seed gs
JOIN teams ht ON ht.name = gs.home_name
JOIN teams at ON at.name = gs.away_name
JOIN venues v ON v.name = gs.venue_name
ON CONFLICT (schedule_order) DO UPDATE
SET stage = EXCLUDED.stage,
    group_code = EXCLUDED.group_code,
    kickoff_local_date = EXCLUDED.kickoff_local_date,
    home_team_id = EXCLUDED.home_team_id,
    away_team_id = EXCLUDED.away_team_id,
    venue_id = EXCLUDED.venue_id,
    source_url = EXCLUDED.source_url,
    source_last_checked_at = now();

WITH knockout_seed(schedule_order, fifa_match_number, stage, kickoff_local_date, home_placeholder, away_placeholder, venue_name) AS (
  VALUES
    (73, 73, 'round_of_32'::match_stage, DATE '2026-06-28', 'Group A runners-up', 'Group B runners-up', 'Los Angeles Stadium'),
    (74, 74, 'round_of_32'::match_stage, DATE '2026-06-29', 'Group E winners', 'Group A/B/C/D/F third place', 'Boston Stadium'),
    (75, 75, 'round_of_32'::match_stage, DATE '2026-06-29', 'Group F winners', 'Group C runners-up', 'Estadio Monterrey'),
    (76, 76, 'round_of_32'::match_stage, DATE '2026-06-29', 'Group C winners', 'Group F runners-up', 'Houston Stadium'),
    (77, 77, 'round_of_32'::match_stage, DATE '2026-06-30', 'Group I winners', 'Group C/D/F/G/H third place', 'New York New Jersey Stadium'),
    (78, 78, 'round_of_32'::match_stage, DATE '2026-06-30', 'Group E runners-up', 'Group I runners-up', 'Dallas Stadium'),
    (79, 79, 'round_of_32'::match_stage, DATE '2026-06-30', 'Group A winners', 'Group C/E/F/H/I third place', 'Mexico City Stadium'),
    (80, 80, 'round_of_32'::match_stage, DATE '2026-07-01', 'Group L winners', 'Group E/H/I/J/K third place', 'Atlanta Stadium'),
    (81, 81, 'round_of_32'::match_stage, DATE '2026-07-01', 'Group D winners', 'Group B/E/F/I/J third place', 'San Francisco Bay Area Stadium'),
    (82, 82, 'round_of_32'::match_stage, DATE '2026-07-01', 'Group G winners', 'Group A/E/H/I/J third place', 'Seattle Stadium'),
    (83, 83, 'round_of_32'::match_stage, DATE '2026-07-02', 'Group K runners-up', 'Group L runners-up', 'Toronto Stadium'),
    (84, 84, 'round_of_32'::match_stage, DATE '2026-07-02', 'Group H winners', 'Group J runners-up', 'Los Angeles Stadium'),
    (85, 85, 'round_of_32'::match_stage, DATE '2026-07-02', 'Group B winners', 'Group E/F/G/I/J third place', 'BC Place Vancouver'),
    (86, 86, 'round_of_32'::match_stage, DATE '2026-07-03', 'Group J winners', 'Group H runners-up', 'Miami Stadium'),
    (87, 87, 'round_of_32'::match_stage, DATE '2026-07-03', 'Group K winners', 'Group D/E/I/J/L third place', 'Kansas City Stadium'),
    (88, 88, 'round_of_32'::match_stage, DATE '2026-07-03', 'Group D runners-up', 'Group G runners-up', 'Dallas Stadium'),
    (89, 89, 'round_of_16'::match_stage, DATE '2026-07-04', 'Winner match 74', 'Winner match 77', 'Philadelphia Stadium'),
    (90, 90, 'round_of_16'::match_stage, DATE '2026-07-04', 'Winner match 73', 'Winner match 75', 'Houston Stadium'),
    (91, 91, 'round_of_16'::match_stage, DATE '2026-07-05', 'Winner match 76', 'Winner match 78', 'New York New Jersey Stadium'),
    (92, 92, 'round_of_16'::match_stage, DATE '2026-07-05', 'Winner match 79', 'Winner match 80', 'Mexico City Stadium'),
    (93, 93, 'round_of_16'::match_stage, DATE '2026-07-06', 'Winner match 83', 'Winner match 84', 'Dallas Stadium'),
    (94, 94, 'round_of_16'::match_stage, DATE '2026-07-06', 'Winner match 81', 'Winner match 82', 'Seattle Stadium'),
    (95, 95, 'round_of_16'::match_stage, DATE '2026-07-07', 'Winner match 86', 'Winner match 88', 'Atlanta Stadium'),
    (96, 96, 'round_of_16'::match_stage, DATE '2026-07-07', 'Winner match 85', 'Winner match 87', 'BC Place Vancouver'),
    (97, 97, 'quarter_final'::match_stage, DATE '2026-07-09', 'Winner match 89', 'Winner match 90', 'Boston Stadium'),
    (98, 98, 'quarter_final'::match_stage, DATE '2026-07-10', 'Winner match 93', 'Winner match 94', 'Los Angeles Stadium'),
    (99, 99, 'quarter_final'::match_stage, DATE '2026-07-11', 'Winner match 91', 'Winner match 92', 'Miami Stadium'),
    (100, 100, 'quarter_final'::match_stage, DATE '2026-07-11', 'Winner match 95', 'Winner match 96', 'Kansas City Stadium'),
    (101, 101, 'semi_final'::match_stage, DATE '2026-07-14', 'Winner match 97', 'Winner match 98', 'Dallas Stadium'),
    (102, 102, 'semi_final'::match_stage, DATE '2026-07-15', 'Winner match 99', 'Winner match 100', 'Atlanta Stadium'),
    (103, 103, 'third_place'::match_stage, DATE '2026-07-18', 'Runner-up match 101', 'Runner-up match 102', 'Miami Stadium'),
    (104, 104, 'final'::match_stage, DATE '2026-07-19', 'Winner match 101', 'Winner match 102', 'New York New Jersey Stadium')
)
INSERT INTO tournament_matches (
  schedule_order,
  fifa_match_number,
  stage,
  group_code,
  kickoff_local_date,
  home_placeholder,
  away_placeholder,
  venue_id,
  source_url
)
SELECT
  ks.schedule_order,
  ks.fifa_match_number,
  ks.stage,
  NULL,
  ks.kickoff_local_date,
  ks.home_placeholder,
  ks.away_placeholder,
  v.id,
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums'
FROM knockout_seed ks
JOIN venues v ON v.name = ks.venue_name
ON CONFLICT (schedule_order) DO UPDATE
SET fifa_match_number = EXCLUDED.fifa_match_number,
    stage = EXCLUDED.stage,
    group_code = EXCLUDED.group_code,
    kickoff_local_date = EXCLUDED.kickoff_local_date,
    home_placeholder = EXCLUDED.home_placeholder,
    away_placeholder = EXCLUDED.away_placeholder,
    venue_id = EXCLUDED.venue_id,
    source_url = EXCLUDED.source_url,
    source_last_checked_at = now();

COMMIT;
