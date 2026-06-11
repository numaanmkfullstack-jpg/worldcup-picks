import type { LeaderboardEntry } from "@/lib/types";

export function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="leaderboard">
      {entries.map((entry) => (
        <div className="leader-row" key={entry.userId}>
          <div className="leader-main">
            <span className="rank">{entry.rank}</span>
            <span className="avatar">{entry.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{entry.displayName}</strong>
              <div className="muted">
                {entry.exactScores} exact scores · {entry.correctOutcomes} right outcomes
              </div>
            </div>
          </div>
          <div>
            <div className="points">{entry.totalPoints}</div>
            <div className="muted">points</div>
          </div>
        </div>
      ))}
    </div>
  );
}
