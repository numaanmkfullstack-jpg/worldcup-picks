import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    matchId?: string;
    predictedHomeScore?: number;
    predictedAwayScore?: number;
    action?: "save" | "lock";
  };

  if (!body.matchId) {
    return NextResponse.json({ error: "Missing match details." }, { status: 400 });
  }

  if (!Number.isInteger(body.predictedHomeScore) || !Number.isInteger(body.predictedAwayScore)) {
    return NextResponse.json({ error: "Scores must be whole numbers." }, { status: 400 });
  }

  if (!hasDatabase) {
    return NextResponse.json({ message: "Preview saved. Add DATABASE_URL to persist predictions in Neon." });
  }

  const db = requireSql();
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) {
    return NextResponse.json({ error: "Log in and finish password setup before predicting." }, { status: 401 });
  }

  if (!user.organizationId) {
    return NextResponse.json({ error: "You are not in an org yet." }, { status: 403 });
  }

  const action = body.action === "lock" ? "lock" : "save";
  const matchRows = await db`
    SELECT kickoff_at, status
    FROM tournament_matches
    WHERE id = ${body.matchId}
    LIMIT 1
  `;
  const match = (matchRows as { kickoff_at: string | Date | null; status: string }[])[0];
  const kickoffAt = match?.kickoff_at ? new Date(match.kickoff_at) : null;
  const matchClosed =
    !match ||
    match.status === "live" ||
    match.status === "full_time" ||
    match.status === "cancelled" ||
    (kickoffAt !== null && Date.now() >= kickoffAt.getTime());

  if (matchClosed) {
    return NextResponse.json({ error: "Predictions are closed for this match." }, { status: 409 });
  }

  await db`
    INSERT INTO predictions (
      organization_id,
      user_id,
      match_id,
      predicted_home_score,
      predicted_away_score,
      locked_at,
      lock_reason
    )
    VALUES (
      ${user.organizationId},
      ${user.id},
      ${body.matchId},
      ${body.predictedHomeScore},
      ${body.predictedAwayScore},
      ${action === "lock" ? new Date() : null},
      ${action === "lock" ? "user" : null}
    )
    ON CONFLICT (organization_id, user_id, match_id) DO UPDATE
    SET predicted_home_score = EXCLUDED.predicted_home_score,
        predicted_away_score = EXCLUDED.predicted_away_score,
        locked_at = CASE WHEN EXCLUDED.locked_at IS NOT NULL THEN EXCLUDED.locked_at ELSE predictions.locked_at END,
        lock_reason = CASE WHEN EXCLUDED.lock_reason IS NOT NULL THEN EXCLUDED.lock_reason ELSE predictions.lock_reason END
  `;

  return NextResponse.json({
    message: action === "lock" ? "Prediction locked. You cannot change it now." : "Prediction saved. You can still edit it before kickoff.",
  });
}
