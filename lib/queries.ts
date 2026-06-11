import { hasDatabase, requireSql } from "@/lib/db";
import { demoFixtures, demoLeaderboard, demoOrg } from "@/lib/demo-data";
import { codeForTeamName, flagForCode } from "@/lib/flags";
import type { Fixture, LeaderboardEntry, OrgSummary, UserPrediction } from "@/lib/types";

type FixtureRow = {
  id: string;
  schedule_order: number;
  fifa_match_number: number | null;
  stage: Fixture["stage"];
  group_code: string | null;
  kickoff_at: string | Date | null;
  kickoff_local_date: string | Date;
  home_name: string | null;
  away_name: string | null;
  home_code: string | null;
  away_code: string | null;
  home_placeholder: string | null;
  away_placeholder: string | null;
  venue: string | null;
  city: string | null;
  status: Fixture["status"];
  home_score: number | null;
  away_score: number | null;
  predictions_locked_at: string | Date | null;
  predictions_lock_reason: string | null;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  invite_code: string;
  points_correct_outcome: number;
  points_exact_score: number;
};

type LeaderboardRow = {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  predictions_made: number;
  predictions_scored: number;
  exact_scores: number;
  correct_outcomes: number;
};

type OrgUserRow = {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "member";
  must_change_password: boolean;
  disabled_at: string | Date | null;
  joined_at: string | Date;
};

type UserPredictionRow = {
  match_id: string;
  predicted_home_score: number;
  predicted_away_score: number;
  locked_at: string | Date | null;
  lock_reason: "user" | "kickoff" | null;
};

function toDateString(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function toTimestampString(value: string | Date | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function mapFixture(row: FixtureRow): Fixture {
  const homeName = row.home_name ?? row.home_placeholder ?? "TBD";
  const awayName = row.away_name ?? row.away_placeholder ?? "TBD";
  const homeCode = row.home_code ?? codeForTeamName(homeName);
  const awayCode = row.away_code ?? codeForTeamName(awayName);

  return {
    id: row.id,
    scheduleOrder: row.schedule_order,
    matchNumber: row.fifa_match_number,
    stage: row.stage,
    groupCode: row.group_code,
    kickoffAt: toTimestampString(row.kickoff_at),
    kickoffLocalDate: toDateString(row.kickoff_local_date),
    homeName,
    awayName,
    homeCode,
    awayCode,
    homeFlag: flagForCode(homeCode),
    awayFlag: flagForCode(awayCode),
    venue: row.venue ?? "Venue TBD",
    city: row.city,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    predictionsLockedAt: toTimestampString(row.predictions_locked_at),
    predictionsLockReason: row.predictions_lock_reason,
  };
}

export async function getFixtures(limit?: number): Promise<Fixture[]> {
  if (!hasDatabase) {
    return typeof limit === "number" ? demoFixtures.slice(0, limit) : demoFixtures;
  }

  const db = requireSql();
  const rows = await db`
    SELECT
      tm.id,
      tm.schedule_order,
      tm.fifa_match_number,
      tm.stage,
      tm.group_code,
      tm.kickoff_at,
      tm.kickoff_local_date,
      ht.name AS home_name,
      at.name AS away_name,
      ht.fifa_code AS home_code,
      at.fifa_code AS away_code,
      tm.home_placeholder,
      tm.away_placeholder,
      v.name AS venue,
      v.city,
      tm.status,
      tm.home_score,
      tm.away_score,
      tm.predictions_locked_at,
      tm.predictions_lock_reason
    FROM tournament_matches tm
    LEFT JOIN teams ht ON ht.id = tm.home_team_id
    LEFT JOIN teams at ON at.id = tm.away_team_id
    LEFT JOIN venues v ON v.id = tm.venue_id
    ORDER BY tm.schedule_order
    LIMIT ${limit ?? 104}
  `;

  return (rows as FixtureRow[]).map(mapFixture);
}

export async function getFeaturedFixtures(): Promise<Fixture[]> {
  const fixtures = await getFixtures(12);
  return fixtures.slice(0, 6);
}

export async function getDefaultOrg(): Promise<OrgSummary> {
  if (!hasDatabase) {
    return demoOrg;
  }

  const db = requireSql();
  const rows = await db`
    SELECT id, name, slug, invite_code, points_correct_outcome, points_exact_score
    FROM organizations
    ORDER BY created_at ASC
    LIMIT 1
  `;

  const row = (rows as OrgRow[])[0];
  if (!row) {
    return demoOrg;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    inviteCode: row.invite_code,
    pointsCorrectOutcome: row.points_correct_outcome,
    pointsExactScore: row.points_exact_score,
  };
}

export async function getLeaderboard(orgId?: string): Promise<LeaderboardEntry[]> {
  if (!hasDatabase) {
    return demoLeaderboard;
  }

  const org = orgId ? null : await getDefaultOrg();
  const targetOrgId = orgId ?? org?.id;
  if (!targetOrgId || targetOrgId === demoOrg.id) {
    return demoLeaderboard;
  }

  const db = requireSql();
  const rows = await db`
    SELECT rank, user_id, display_name, avatar_url, total_points, predictions_made, predictions_scored, exact_scores, correct_outcomes
    FROM organization_leaderboard
    WHERE organization_id = ${targetOrgId}
    ORDER BY rank ASC, total_points DESC, display_name ASC
  `;

  return (rows as LeaderboardRow[]).map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    totalPoints: row.total_points,
    predictionsMade: row.predictions_made,
    predictionsScored: row.predictions_scored,
    exactScores: row.exact_scores,
    correctOutcomes: row.correct_outcomes,
  }));
}

export async function getOrganizationUsers(organizationId: string) {
  if (!hasDatabase) {
    return [];
  }

  const db = requireSql();
  const rows = await db`
    SELECT
      u.id,
      u.email,
      u.display_name,
      om.role,
      u.must_change_password,
      u.disabled_at,
      om.joined_at
    FROM organization_members om
    JOIN app_users u ON u.id = om.user_id
    WHERE om.organization_id = ${organizationId}
    ORDER BY om.role ASC, om.joined_at ASC
  `;

  return (rows as OrgUserRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
    disabled: Boolean(row.disabled_at),
  }));
}

export async function getUserPredictions(organizationId: string, userId: string): Promise<UserPrediction[]> {
  if (!hasDatabase) {
    return [];
  }

  const db = requireSql();
  const rows = await db`
    SELECT match_id, predicted_home_score, predicted_away_score, locked_at, lock_reason
    FROM predictions
    WHERE organization_id = ${organizationId}
      AND user_id = ${userId}
  `;

  return (rows as UserPredictionRow[]).map((row) => ({
    matchId: row.match_id,
    predictedHomeScore: row.predicted_home_score,
    predictedAwayScore: row.predicted_away_score,
    lockedAt: toTimestampString(row.locked_at),
    lockReason: row.lock_reason,
  }));
}
