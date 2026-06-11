import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    matchId?: string;
    homeScore?: number;
    awayScore?: number;
    source?: "manual" | "api";
  };

  if (!body.matchId) {
    return NextResponse.json({ error: "Missing match." }, { status: 400 });
  }

  if (!Number.isInteger(body.homeScore) || !Number.isInteger(body.awayScore)) {
    return NextResponse.json({ error: "Final scores must be whole numbers." }, { status: 400 });
  }

  if (!hasDatabase) {
    return NextResponse.json({ message: "Preview result accepted. Add DATABASE_URL to update Neon." });
  }

  const db = requireSql();
  const admin = await getCurrentUser();
  if (!admin || admin.mustChangePassword) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Only admins can update results." }, { status: 403 });
  }

  await db`
    UPDATE tournament_matches
    SET home_score = ${body.homeScore},
        away_score = ${body.awayScore},
        status = 'full_time',
        result_source = ${body.source ?? "manual"},
        result_confirmed_by_user_id = ${admin.id},
        result_confirmed_at = now(),
        winner_team_id = CASE
          WHEN ${body.homeScore} > ${body.awayScore} THEN home_team_id
          WHEN ${body.awayScore} > ${body.homeScore} THEN away_team_id
          ELSE NULL
        END
    WHERE id = ${body.matchId}
  `;

  return NextResponse.json({ message: "Final score saved. Leaderboard will recalculate automatically." });
}
