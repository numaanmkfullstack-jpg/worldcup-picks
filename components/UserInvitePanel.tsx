"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function UserInvitePanel() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();

  function createUser() {
    setStatus("");
    startTransition(async () => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      setStatus(payload.message ?? payload.error ?? "Done.");
      if (response.ok) {
        setDisplayName("");
        setEmail("");
        setPassword("");
        router.refresh();
      }
    });
  }

  return (
    <div className="panel">
      <h2>Add User</h2>
      <p className="muted">Admins create a temporary password. The user must change it on first login.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="inviteName">Name</label>
          <input id="inviteName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="inviteEmail">Email</label>
          <input id="inviteEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="invitePassword">Temporary password</label>
          <input id="invitePassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <button className="button" disabled={isPending} onClick={createUser} type="button">
          {isPending ? "Creating..." : "Create invited user"}
        </button>
        <div className="status-line">{status}</div>
      </div>
    </div>
  );
}
