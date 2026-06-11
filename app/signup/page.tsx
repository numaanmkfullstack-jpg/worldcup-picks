import Link from "next/link";
import { AuthForm } from "@/components/AuthForms";
import { hasAnyUsers } from "@/lib/auth";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const alreadyBootstrapped = await hasAnyUsers();

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">Bootstrap admin</span>
          <h1>First Signup</h1>
          <p className="lede">Only the first signup is allowed here. After that, admins invite users from the Users page.</p>
        </div>
      </section>

      {alreadyBootstrapped ? (
        <div className="panel auth-panel">
          <h2>Signup is closed</h2>
          <p className="muted">Your league already has an admin. Ask an admin to create your account.</p>
          <Link className="button" href="/login">
            Go to login
          </Link>
        </div>
      ) : (
        <AuthForm error={params.error} message={params.message} mode="signup" />
      )}
    </>
  );
}
