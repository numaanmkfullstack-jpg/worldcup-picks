import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasDatabase, requireSql } from "@/lib/db";
import { scrapeEspnResult } from "@/lib/results/espn-scoreboard";
import { scrapeFifaResult } from "@/lib/results/fifa-scraper";
import { scrapeSearchResult } from "@/lib/results/web-search-scraper";

type MatchRow = {
  id: string;
  home_name: string | null;
  away_name: string | null;
  home_code: string | null;
  away_code: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  kickoff_local_date: string | Date;
};

type ScrapedResult = {
  homeScore: number;
  awayScore: number;
  sourceUrl: string;
  matchedText: string;
};

export async function POST(request: Request) {
  if (!hasDatabase) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 400 });
  }

  const admin = await getCurrentUser();
  if (!admin || admin.mustChangePassword) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Only admins can pull results." }, { status: 403 });
  }

  const body = (await request.json()) as { matchId?: string };
  if (!body.matchId) {
    return NextResponse.json({ error: "Missing match." }, { status: 400 });
  }

  const db = requireSql();
  const matchRows = await db`
    SELECT
      tm.id,
      ht.name AS home_name,
      at.name AS away_name,
      ht.fifa_code AS home_code,
      at.fifa_code AS away_code,
      tm.home_placeholder,
      tm.away_placeholder,
      tm.kickoff_local_date
    FROM tournament_matches tm
    LEFT JOIN teams ht ON ht.id = tm.home_team_id
    LEFT JOIN teams at ON at.id = tm.away_team_id
    WHERE tm.id = ${body.matchId}
    LIMIT 1
  `;

  const match = (matchRows as MatchRow[])[0];
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }

  const homeName = match.home_name ?? match.home_placeholder;
  const awayName = match.away_name ?? match.away_placeholder;
  if (!homeName || !awayName || homeName.includes("Winner") || awayName.includes("Winner")) {
    return NextResponse.json({ error: "This match does not have concrete teams to scrape yet." }, { status: 409 });
  }

  let provider = "fifa-scraper";
  let scraped: ScrapedResult | null = await scrapeFifaResult(homeName, awayName);

  if (!scraped) {
    provider = "espn-scoreboard";
    scraped = await scrapeEspnResult({
      homeName,
      awayName,
      homeCode: match.home_code,
      awayCode: match.away_code,
      kickoffLocalDate: match.kickoff_local_date,
    });
  }

  if (!scraped) {
    provider = "web-search-scraper";
    scraped = await scrapeSearchResult(homeName, awayName);
  }

  if (!scraped) {
    await db`
      INSERT INTO result_import_runs (
        requested_by_user_id,
        provider,
        status,
        matches_checked,
        matches_updated,
        error_message,
        finished_at
      )
      VALUES (${admin.id}, 'fifa-espn-search-scraper', 'not_found', 3, 0, 'No final score found on FIFA, ESPN, or search fallback', now())
    `;
    return NextResponse.json(
      {
        error: "No final result found on FIFA, ESPN, or search fallback.",
      }
    );
  }

  await db`
    UPDATE tournament_matches
    SET home_score = ${scraped.homeScore},
        away_score = ${scraped.awayScore},
        status = 'full_time',
        result_source = 'api',
        result_confirmed_by_user_id = ${admin.id},
        result_confirmed_at = now(),
        winner_team_id = CASE
          WHEN ${scraped.homeScore} > ${scraped.awayScore} THEN home_team_id
          WHEN ${scraped.awayScore} > ${scraped.homeScore} THEN away_team_id
          ELSE NULL
        END
    WHERE id = ${match.id}
  `;

  await db`
    INSERT INTO result_import_runs (
      requested_by_user_id,
      provider,
      status,
      matches_checked,
      matches_updated,
      finished_at
    )
    VALUES (${admin.id}, ${provider}, 'finished', 1, 1, now())
  `;

  return NextResponse.json({
    message: `Pulled via ${provider}: ${homeName} ${scraped.homeScore}-${scraped.awayScore} ${awayName}. Leaderboard updated.`,
    homeScore: scraped.homeScore,
    awayScore: scraped.awayScore,
    sourceUrl: scraped.sourceUrl,
  });
}
