export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter_final"
  | "semi_final"
  | "third_place"
  | "final";

export type Fixture = {
  id: string;
  scheduleOrder: number;
  matchNumber: number | null;
  stage: MatchStage;
  groupCode: string | null;
  kickoffAt: string | null;
  kickoffLocalDate: string;
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  homeFlag: string;
  awayFlag: string;
  venue: string;
  city: string | null;
  status: "scheduled" | "live" | "full_time" | "postponed" | "cancelled";
  homeScore: number | null;
  awayScore: number | null;
  predictionsLockedAt?: string | null;
  predictionsLockReason?: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPoints: number;
  predictionsMade: number;
  predictionsScored: number;
  exactScores: number;
  correctOutcomes: number;
};

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  pointsCorrectOutcome: number;
  pointsExactScore: number;
};

export type UserPrediction = {
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  lockedAt: string | null;
  lockReason: "user" | "kickoff" | null;
};

export type PredictionState = UserPrediction & {
  matchClosed: boolean;
  canEdit: boolean;
  statusLabel: string;
};
