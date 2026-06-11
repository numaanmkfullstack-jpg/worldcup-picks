-- Adds admin-controlled prediction locks per match.

BEGIN;

ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS predictions_locked_at timestamptz;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS predictions_locked_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS predictions_lock_reason text;

ALTER TABLE tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_predictions_lock_check;
ALTER TABLE tournament_matches ADD CONSTRAINT tournament_matches_predictions_lock_check
  CHECK (
    (predictions_locked_at IS NULL AND predictions_locked_by_user_id IS NULL AND predictions_lock_reason IS NULL)
    OR (predictions_locked_at IS NOT NULL AND predictions_lock_reason IS NOT NULL)
  );

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

COMMIT;
