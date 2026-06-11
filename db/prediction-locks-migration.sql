-- Run this in Neon if you already have the base schema.
-- Adds save-vs-lock prediction behavior and DB-level edit protection.

BEGIN;

ALTER TABLE predictions ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS lock_reason text;

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_lock_reason_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_lock_reason_check
  CHECK (lock_reason IS NULL OR lock_reason IN ('user', 'kickoff'));

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_locked_pair_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_locked_pair_check
  CHECK ((locked_at IS NULL AND lock_reason IS NULL) OR (locked_at IS NOT NULL AND lock_reason IS NOT NULL));

CREATE OR REPLACE FUNCTION assert_prediction_allowed()
RETURNS trigger AS $$
DECLARE
  match_kickoff timestamptz;
  match_status match_status;
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

  SELECT tm.kickoff_at, tm.status, o.prediction_lock_minutes_before_kickoff
  INTO match_kickoff, match_status, lock_minutes
  FROM tournament_matches tm
  JOIN organizations o ON o.id = NEW.organization_id
  WHERE tm.id = NEW.match_id;

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

COMMIT;
