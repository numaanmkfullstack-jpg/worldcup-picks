"use client";

import { useState, useTransition } from "react";
import type { OrgSummary } from "@/lib/types";

export function OrgPanel({ org }: { org: OrgSummary }) {
  const [name, setName] = useState("Matchday Crew");
  const [displayName, setDisplayName] = useState("Numa");
  const [email, setEmail] = useState("numa@example.com");
  const [inviteCode, setInviteCode] = useState(org.inviteCode);
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function createOrg() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, displayName, email }),
      });
      const payload = (await response.json()) as { message?: string; error?: string; inviteCode?: string };
      if (payload.inviteCode) {
        setInviteCode(payload.inviteCode);
      }
      setStatus(payload.message ?? payload.error ?? "Org ready.");
    });
  }

  return (
    <div className="two-col">
      <div className="panel">
        <h2>Create Your Org</h2>
        <p className="muted">Start a private prediction league for your friends, work team, or family chat.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="orgName">Org name</label>
            <input id="orgName" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="orgDisplayName">Your name</label>
            <input id="orgDisplayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="orgEmail">Email</label>
            <input id="orgEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <button className="button" disabled={isPending} onClick={createOrg} type="button">
            {isPending ? "Creating..." : "Create org"}
          </button>
          <div className="status-line">{status}</div>
        </div>
      </div>

      <div className="panel">
        <h2>Invite Code</h2>
        <p className="lede">{inviteCode}</p>
        <p className="muted">Share this code with friends so they join the same leaderboard.</p>
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
            <strong>1</strong>
            <span className="muted">pick per match</span>
          </div>
        </div>
      </div>
    </div>
  );
}
