import { AuthForm } from "@/components/AuthForms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">Welcome back</span>
          <h1>Login</h1>
          <p className="lede">Sign in with the account your admin created for you.</p>
        </div>
      </section>

      <AuthForm error={params.error} message={params.message} mode="login" />
    </>
  );
}
