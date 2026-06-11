import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";

type ResultBody = {
  matchId?: string;
  scheduleOrder?: number;
  fifaMatchNumber?: number;
  homeScore?: number;
  awayScore?: number;
  status?: "live" | "full_time" | "postponed" | "cancelled";
};

type ResultRow = {
  id: string;
  schedule_order: number;
  fifa_match_number: number | null;
  home_name: string | null;
  away_name: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
  result_source: string | null;
  result_confirmed_at: string | Date | null;
};

function isAuthorizedBySecret(request: Request) {
  const configuredSecret = process.env.RESULTS_API_SECRET;
  const providedSecret = request.headers.get("x-results-secret");

  return Boolean(configuredSecret && providedSecret && configuredSecret === providedSecret);
}

function mapResult(row: ResultRow) {
  return {
    id: row.id,
    scheduleOrder: row.schedule_order,
    fifaMatchNumber: row.fifa_match_number,
    homeName: row.home_name ?? row.home_placeholder ?? "TBD",
    awayName: row.away_name ?? row.away_placeholder ?? "TBD",
    homeScore: row.home_score,
    awayScore: row.away_score,
    status: row.status,
    resultSource: row.result_source,
    resultConfirmedAt: row.result_confirmed_at,
  };
}

export async function GET(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId");
  const scheduleOrder = url.searchParams.get("scheduleOrder");
  const fifaMatchNumber = url.searchParams.get("fifaMatchNumber");
  const db = requireSql();

  const rows = await db`
    SELECT
      tm.id,
      tm.schedule_order,
      tm.fifa_match_number,
      ht.name AS home_name,
      at.name AS away_name,
      tm.home_placeholder,
      tm.away_placeholder,
      tm.home_score,
      tm.away_score,
      tm.status,
      tm.result_source,
      tm.result_confirmed_at
    FROM tournament_matches tm
    LEFT JOIN teams ht ON ht.id = tm.home_team_id
    LEFT JOIN teams at ON at.id = tm.away_team_id
    WHERE (${matchId}::uuid IS NULL OR tm.id = ${matchId}::uuid)
      AND (${scheduleOrder}::integer IS NULL OR tm.schedule_order = ${scheduleOrder}::integer)
      AND (${fifaMatchNumber}::integer IS NULL OR tm.fifa_match_number = ${fifaMatchNumber}::integer)
    ORDER BY tm.schedule_order ASC
  `;

  return NextResponse.json({ results: (rows as ResultRow[]).map(mapResult) });
}

export async function POST(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const secretAuthorized = isAuthorizedBySecret(request);
  const user = secretAuthorized ? null : await getCurrentUser();
  if (!secretAuthorized && user?.role !== "admin") {
    return NextResponse.json({ error: "Only admins or trusted result clients can update results." }, { status: 403 });
  }

  const body = (await request.json()) as ResultBody;
  if (!body.matchId && !body.scheduleOrder && !body.fifaMatchNumber) {
    return NextResponse.json({ error: "Provide matchId, scheduleOrder, or fifaMatchNumber." }, { status: 400 });
  }

  if (!Number.isInteger(body.homeScore) || !Number.isInteger(body.awayScore)) {
    return NextResponse.json({ error: "homeScore and awayScore must be whole numbers." }, { status: 400 });
  }

  const status = body.status ?? "full_time";
  const db = requireSql();

  const updatedRows = await db`
    UPDATE tournament_matches
    SET home_score = ${body.homeScore},
        away_score = ${body.awayScore},
        status = ${status},
        result_source = 'api',
        result_confirmed_by_user_id = ${user?.id ?? null},
        result_confirmed_at = now(),
        winner_team_id = CASE
          WHEN ${body.homeScore} > ${body.awayScore} THEN home_team_id
          WHEN ${body.awayScore} > ${body.homeScore} THEN away_team_id
          ELSE NULL
        END
    WHERE (${body.matchId ?? null}::uuid IS NULL OR id = ${body.matchId ?? null}::uuid)
      AND (${body.scheduleOrder ?? null}::integer IS NULL OR schedule_order = ${body.scheduleOrder ?? null}::integer)
      AND (${body.fifaMatchNumber ?? null}::integer IS NULL OR fifa_match_number = ${body.fifaMatchNumber ?? null}::integer)
    RETURNING id, schedule_order, fifa_match_number
  `;

  const updated = updatedRows as Array<{ id: string; schedule_order: number; fifa_match_number: number | null }>;
  if (updated.length !== 1) {
    return NextResponse.json({ error: `Expected 1 match update, updated ${updated.length}.` }, { status: 404 });
  }

  await db`
    INSERT INTO result_import_runs (
      requested_by_user_id,
      provider,
      status,
      matches_checked,
      matches_updated,
      finished_at
    )
    VALUES (${user?.id ?? null}, 'custom-results-api', 'finished', 1, 1, now())
  `;

  return NextResponse.json({
    message: "Result updated.",
    match: {
      id: updated[0].id,
      scheduleOrder: updated[0].schedule_order,
      fifaMatchNumber: updated[0].fifa_match_number,
    },
  });
}
