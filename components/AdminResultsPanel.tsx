"use client";

import { useMemo, useState, useTransition } from "react";
import type { Fixture } from "@/lib/types";

export function AdminResultsPanel({ fixtures }: { fixtures: Fixture[] }) {
  const [selectedMatchId, setSelectedMatchId] = useState(fixtures[0]?.id ?? "");
  const [homeScore, setHomeScore] = useState("0");
  const [awayScore, setAwayScore] = useState("0");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedMatch = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedMatchId) ?? fixtures[0],
    [fixtures, selectedMatchId],
  );

  function submitResult(source: "manual" | "api") {
    if (!selectedMatch) {
      return;
    }

    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/admin/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          homeScore: Number(homeScore),
          awayScore: Number(awayScore),
          source,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      setStatus(payload.message ?? payload.error ?? "Result updated.");
    });
  }

  function pullScrapedResult() {
    if (!selectedMatch) {
      return;
    }

    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/admin/results/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: selectedMatch.id,
        }),
      });

      const payload = (await response.json()) as {
        message?: string;
        error?: string;
        homeScore?: number;
        awayScore?: number;
      };

      if (response.ok && Number.isInteger(payload.homeScore) && Number.isInteger(payload.awayScore)) {
        setHomeScore(String(payload.homeScore));
        setAwayScore(String(payload.awayScore));
      }

      setStatus(payload.message ?? payload.error ?? "Result pull finished.");
    });
  }

  function togglePredictionLock(locked: boolean) {
    if (!selectedMatch) {
      return;
    }

    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/admin/matches/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          locked,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      setStatus(payload.message ?? payload.error ?? "Prediction lock updated.");
      if (response.ok) {
        window.location.reload();
      }
    });
  }

  return (
    <div className="panel">
      <div className="section-header">
        <div>
          <h2>Admin Results Desk</h2>
          <p className="muted">Enter confirmed scores manually, or pull from the official FIFA source when a match is finished.</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="adminMatch">Match</label>
          <select id="adminMatch" value={selectedMatchId} onChange={(event) => setSelectedMatchId(event.target.value)}>
            {fixtures.map((fixture) => (
              <option key={fixture.id} value={fixture.id}>
                #{fixture.scheduleOrder} {fixture.homeName} vs {fixture.awayName}
                {fixture.predictionsLockedAt ? " · predictions locked" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="notice">
          {selectedMatch?.predictionsLockedAt
            ? "Predictions are locked for this match. Users cannot add or change picks."
            : "Predictions are open for this match until user lock, kickoff lock, result entry, or admin lock."}
        </div>

        <div className="score-inputs">
          <div className="field">
            <label htmlFor="adminHome">{selectedMatch?.homeName ?? "Home"}</label>
            <input id="adminHome" min="0" type="number" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
          </div>
          <strong className="versus">FT</strong>
          <div className="field">
            <label htmlFor="adminAway">{selectedMatch?.awayName ?? "Away"}</label>
            <input id="adminAway" min="0" type="number" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
          </div>
        </div>

        <div className="actions">
          {selectedMatch?.predictionsLockedAt ? (
            <button className="ghost-button" disabled={isPending} onClick={() => togglePredictionLock(false)} type="button">
              Reopen predictions
            </button>
          ) : (
            <button className="ghost-button" disabled={isPending} onClick={() => togglePredictionLock(true)} type="button">
              Lock predictions
            </button>
          )}
          <button className="button" disabled={isPending} onClick={() => submitResult("manual")} type="button">
            Save final score
          </button>
          <button className="ghost-button" disabled={isPending} onClick={pullScrapedResult} type="button">
            Pull from results API
          </button>
        </div>
        <div className="status-line">{status}</div>
      </div>
    </div>
  );
}
