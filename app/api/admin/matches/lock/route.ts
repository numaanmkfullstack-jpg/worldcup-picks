import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";

export async function POST(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const admin = await getCurrentUser();
  if (!admin || admin.mustChangePassword) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Only admins can lock match predictions." }, { status: 403 });
  }

  const body = (await request.json()) as {
    matchId?: string;
    locked?: boolean;
  };

  if (!body.matchId) {
    return NextResponse.json({ error: "Missing match." }, { status: 400 });
  }

  const db = requireSql();
  const rows = body.locked
    ? await db`
        UPDATE tournament_matches
        SET predictions_locked_at = now(),
            predictions_locked_by_user_id = ${admin.id},
            predictions_lock_reason = 'admin'
        WHERE id = ${body.matchId}
        RETURNING id
      `
    : await db`
        UPDATE tournament_matches
        SET predictions_locked_at = NULL,
            predictions_locked_by_user_id = NULL,
            predictions_lock_reason = NULL
        WHERE id = ${body.matchId}
        RETURNING id
      `;

  if ((rows as { id: string }[]).length !== 1) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: body.locked ? "Predictions locked for this match." : "Predictions reopened for this match.",
    locked: Boolean(body.locked),
  });
}
