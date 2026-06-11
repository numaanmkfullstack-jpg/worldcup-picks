import { ArrowRight, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { FlagBadge } from "@/components/FlagBadge";
import { Leaderboard } from "@/components/Leaderboard";
import { MatchCard } from "@/components/MatchCard";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultOrg, getFeaturedFixtures, getLeaderboard } from "@/lib/queries";

export default async function Home() {
  const [fixtures, leaderboard, org, user] = await Promise.all([getFeaturedFixtures(), getLeaderboard(), getDefaultOrg(), getCurrentUser()]);
  const opener = fixtures[0];

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <Sparkles size={16} />
            Private World Cup prediction league
          </span>
          <h1>Call the score before kickoff.</h1>
          <p className="lede">
            Create an org for your friends, predict every matchday, let admins confirm final scores, and watch the leaderboard move after every full-time whistle.
          </p>
          {user ? (
            <div className="notice signed-in-notice">
              Signed in as <strong>{user.displayName}</strong>
              {user.role ? ` · ${user.role}` : ""}
              {user.organizationName ? ` · ${user.organizationName}` : ""}
            </div>
          ) : (
            <div className="notice signed-in-notice">You are not signed in yet. Log in to make predictions.</div>
          )}
          <div className="actions">
            <Link className="button" href="/predict">
              Start predicting <ArrowRight size={18} />
            </Link>
            <Link className="ghost-button" href="/fixtures">
              View fixtures
            </Link>
          </div>
        </div>

        <div className="glass-card stadium-card">
          <div className="pitch" />
          <div className="floating-score">
            <span className="pill">Opening match</span>
            {opener ? (
              <>
                <div className="score-row">
                  <span className="team">
                    <FlagBadge code={opener.homeCode} name={opener.homeName} />
                    {opener.homeName}
                  </span>
                  <strong>2</strong>
                </div>
                <div className="score-row">
                  <span className="team">
                    <FlagBadge code={opener.awayCode} name={opener.awayName} />
                    {opener.awayName}
                  </span>
                  <strong>1</strong>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="mini-stats">
          <div className="mini-stat">
            <strong>+{org.pointsCorrectOutcome}</strong>
            <span className="muted">right winner or draw</span>
          </div>
          <div className="mini-stat">
            <strong>+{org.pointsExactScore}</strong>
            <span className="muted">exact scoreline</span>
          </div>
          <div className="mini-stat">
            <strong>104</strong>
            <span className="muted">fixtures seeded from FIFA</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <h2>Featured Fixtures</h2>
            <p className="muted">Flag-forward cards for every group and knockout match.</p>
          </div>
          <Link className="ghost-button" href="/fixtures">
            All fixtures
          </Link>
        </div>
        <div className="grid">
          {fixtures.map((fixture, index) => (
            <MatchCard key={fixture.id} fixture={fixture} featured={index === 0} />
          ))}
        </div>
      </section>

      <section className="section two-col">
        <div className="panel">
          <h2>How Matchday Works</h2>
          <p className="muted">
            Friends join one org, submit predictions before matches lock, and admins confirm scores manually or through a result provider later.
          </p>
          <div className="form-grid">
            <div className="leader-row">
              <span className="rank">
                <ShieldCheck size={18} />
              </span>
              <div>
                <strong>Predictions stay scoped to the org</strong>
                <div className="muted">One user can play in multiple groups without mixing scores.</div>
              </div>
            </div>
            <div className="leader-row">
              <span className="rank">
                <Trophy size={18} />
              </span>
              <div>
                <strong>Leaderboard is calculated from raw results</strong>
                <div className="muted">No stale totals, no manual point editing.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Top Table</h2>
          <Leaderboard entries={leaderboard.slice(0, 3)} />
        </div>
      </section>
    </>
  );
}
