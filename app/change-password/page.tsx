import { AuthForm } from "@/components/AuthForms";
import { getCurrentUser } from "@/lib/auth";

export default async function ChangePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">First login reset</span>
          <h1>Change Password</h1>
          <p className="lede">
            {user ? `Logged in as ${user.email}.` : "Log in first, then come back here to set your own password."}
          </p>
        </div>
      </section>

      <AuthForm error={params.error} message={params.message} mode="change-password" />
    </>
  );
}
