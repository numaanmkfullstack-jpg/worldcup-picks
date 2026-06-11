import { Leaderboard } from "@/components/Leaderboard";
import { getDefaultOrg, getLeaderboard } from "@/lib/queries";

export default async function LeaderboardPage() {
  const [org, entries] = await Promise.all([getDefaultOrg(), getLeaderboard()]);

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">{org.name}</span>
          <h1>Leaderboard</h1>
          <p className="lede">
            Exact scorelines beat simple outcomes, and rank ties break by exact scores, correct outcomes, fewer scored predictions, then name.
          </p>
        </div>
      </section>

      <section className="two-col">
        <div className="panel">
          <Leaderboard entries={entries} />
        </div>
        <aside className="panel">
          <h2>Scoring</h2>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>+{org.pointsCorrectOutcome}</strong>
              <span className="muted">right winner</span>
            </div>
            <div className="mini-stat">
              <strong>+{org.pointsExactScore}</strong>
              <span className="muted">exact score</span>
            </div>
            <div className="mini-stat">
              <strong>0</strong>
              <span className="muted">miss</span>
            </div>
          </div>
          <p className="notice">Scores are calculated by the database view, not stored manually.</p>
        </aside>
      </section>
    </>
  );
}
