type Mode = "signup" | "login" | "change-password";

export function AuthForm({ mode, error, message }: { mode: Mode; error?: string; message?: string }) {
  const title =
    mode === "signup" ? "Create first admin" : mode === "login" ? "Log in" : "Change your password";
  const description =
    mode === "signup"
      ? "The first account becomes the admin and owns the first org."
      : mode === "login"
        ? "Use the password your admin gave you, then change it if this is your first login."
        : "Choose a private password before entering the prediction room.";
  const endpoint =
    mode === "signup" ? "/api/auth/signup" : mode === "login" ? "/api/auth/login" : "/api/auth/change-password";

  return (
    <div className="panel auth-panel">
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      <form action={endpoint} className="form-grid" method="post">
        {mode !== "change-password" ? (
          <div className="field">
            <label htmlFor="email">Email</label>
            <input autoComplete="email" id="email" name="email" required type="email" />
          </div>
        ) : null}

        {mode === "signup" ? (
          <>
            <div className="field">
              <label htmlFor="displayName">Your name</label>
              <input autoComplete="name" id="displayName" name="displayName" required />
            </div>
            <div className="field">
              <label htmlFor="orgName">Org name</label>
              <input defaultValue="Matchday Crew" id="orgName" name="orgName" required />
            </div>
          </>
        ) : null}

        {mode !== "change-password" ? (
          <div className="field">
            <label htmlFor="password">{mode === "signup" ? "Admin password" : "Password"}</label>
            <input autoComplete={mode === "login" ? "current-password" : "new-password"} id="password" name="password" required type="password" />
          </div>
        ) : null}

        {mode === "change-password" ? (
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input autoComplete="new-password" id="newPassword" name="newPassword" required type="password" />
          </div>
        ) : null}

        <button className="button" type="submit">
          {title}
        </button>
        {error ? <div className="status-line error-line">{error}</div> : null}
        {message ? <div className="status-line">{message}</div> : null}
      </form>
    </div>
  );
}
