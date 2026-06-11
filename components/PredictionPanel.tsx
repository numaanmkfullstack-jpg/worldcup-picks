"use client";

import { useMemo, useState, useTransition } from "react";
import { MatchCard } from "@/components/MatchCard";
import type { Fixture, OrgSummary, PredictionState, UserPrediction } from "@/lib/types";

type PredictionPanelProps = {
  fixtures: Fixture[];
  org: OrgSummary;
  predictions: UserPrediction[];
};

function isMatchClosed(fixture: Fixture) {
  const kickoffAt = fixture.kickoffAt ? new Date(fixture.kickoffAt) : null;

  return (
    Boolean(fixture.predictionsLockedAt) ||
    fixture.status === "live" ||
    fixture.status === "full_time" ||
    fixture.status === "cancelled" ||
    (kickoffAt !== null && Date.now() >= kickoffAt.getTime())
  );
}

function getStatusLabel(fixture: Fixture, prediction?: UserPrediction) {
  if (prediction?.lockedAt) {
    return prediction.lockReason === "user" ? "Locked by you" : "Locked at kickoff";
  }

  if (fixture.predictionsLockedAt) {
    return "Locked by admin";
  }

  if (isMatchClosed(fixture)) {
    return "Closed";
  }

  return prediction ? "Saved and editable" : "No prediction yet";
}

export function PredictionPanel({ fixtures, org, predictions }: PredictionPanelProps) {
  const [selectedMatchId, setSelectedMatchId] = useState(fixtures[0]?.id ?? "");
  const [localPredictions, setLocalPredictions] = useState(predictions);
  const predictionByMatchId = useMemo(
    () => new Map(localPredictions.map((prediction) => [prediction.matchId, prediction])),
    [localPredictions],
  );
  const initialPrediction = predictionByMatchId.get(selectedMatchId);
  const [homeScore, setHomeScore] = useState(String(initialPrediction?.predictedHomeScore ?? 2));
  const [awayScore, setAwayScore] = useState(String(initialPrediction?.predictedAwayScore ?? 1));
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedMatch = useMemo(
    () => fixtures.find((fixture) => fixture.id === selectedMatchId) ?? fixtures[0],
    [fixtures, selectedMatchId],
  );
  const selectedPrediction = selectedMatch ? predictionByMatchId.get(selectedMatch.id) : undefined;
  const predictionState: PredictionState | null = selectedMatch
    ? {
        matchId: selectedMatch.id,
        predictedHomeScore: selectedPrediction?.predictedHomeScore ?? Number(homeScore),
        predictedAwayScore: selectedPrediction?.predictedAwayScore ?? Number(awayScore),
        lockedAt: selectedPrediction?.lockedAt ?? null,
        lockReason: selectedPrediction?.lockReason ?? null,
        matchClosed: isMatchClosed(selectedMatch),
        canEdit: !selectedPrediction?.lockedAt && !isMatchClosed(selectedMatch),
        statusLabel: getStatusLabel(selectedMatch, selectedPrediction),
      }
    : null;

  function selectMatch(matchId: string) {
    setSelectedMatchId(matchId);
    const prediction = predictionByMatchId.get(matchId);
    setHomeScore(String(prediction?.predictedHomeScore ?? 2));
    setAwayScore(String(prediction?.predictedAwayScore ?? 1));
    setStatus("");
  }

  function submitPrediction(action: "save" | "lock") {
    if (!selectedMatch) {
      return;
    }

    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: selectedMatch.id,
          predictedHomeScore: Number(homeScore),
          predictedAwayScore: Number(awayScore),
          action,
        }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      setStatus(payload.message ?? payload.error ?? "Prediction saved.");
      if (response.ok) {
        setLocalPredictions((currentPredictions) => {
          const nextPrediction: UserPrediction = {
            matchId: selectedMatch.id,
            predictedHomeScore: Number(homeScore),
            predictedAwayScore: Number(awayScore),
            lockedAt: action === "lock" ? new Date().toISOString() : null,
            lockReason: action === "lock" ? "user" : null,
          };
          const existingIndex = currentPredictions.findIndex((prediction) => prediction.matchId === selectedMatch.id);

          if (existingIndex === -1) {
            return [...currentPredictions, nextPrediction];
          }

          return currentPredictions.map((prediction, index) => (index === existingIndex ? nextPrediction : prediction));
        });
      }
    });
  }

  return (
    <div className="two-col">
      <div className="panel">
        <div className="section-header">
          <div>
            <h2>Make Your Pick</h2>
            <p className="muted">One prediction per person per org per match. Edit it until kickoff locks.</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="match">Match</label>
            <select id="match" value={selectedMatchId} onChange={(event) => selectMatch(event.target.value)}>
              {fixtures.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>
                  #{fixture.scheduleOrder} {fixture.homeName} vs {fixture.awayName} · {getStatusLabel(fixture, predictionByMatchId.get(fixture.id))}
                </option>
              ))}
            </select>
          </div>

          <div className="score-inputs">
            <div className="field">
              <label htmlFor="homeScore">{selectedMatch?.homeName ?? "Home"}</label>
              <input disabled={!predictionState?.canEdit} id="homeScore" min="0" type="number" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
            </div>
            <strong className="versus">VS</strong>
            <div className="field">
              <label htmlFor="awayScore">{selectedMatch?.awayName ?? "Away"}</label>
              <input disabled={!predictionState?.canEdit} id="awayScore" min="0" type="number" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
            </div>
          </div>

          <p className="notice">Submitting into {org.name}. Your account is taken from your login session.</p>
          {predictionState ? <p className="pill">{predictionState.statusLabel}</p> : null}

          <div className="actions">
            <button className="ghost-button" disabled={isPending || !predictionState?.canEdit} onClick={() => submitPrediction("save")} type="button">
              {isPending ? "Saving..." : "Save editable"}
            </button>
            <button className="button" disabled={isPending || !predictionState?.canEdit} onClick={() => submitPrediction("lock")} type="button">
              {isPending ? "Locking..." : "Lock forever"}
            </button>
          </div>
          <div className="status-line">{status}</div>
        </div>
      </div>

      {selectedMatch ? <MatchCard fixture={selectedMatch} featured /> : null}
    </div>
  );
}
