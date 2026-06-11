export default function Loading() {
  return (
    <div className="loading-shell">
      <div className="loading-card">
        <span className="loading-ball" />
        <div>
          <strong>Loading matchday</strong>
          <p className="muted">Pulling fixtures, predictions, and leaderboard data.</p>
        </div>
      </div>
    </div>
  );
}
