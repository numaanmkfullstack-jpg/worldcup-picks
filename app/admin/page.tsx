import { AdminResultsPanel } from "@/components/AdminResultsPanel";
import { requireAdmin } from "@/lib/auth";
import { getFixtures } from "@/lib/queries";

export default async function AdminPage() {
  await requireAdmin();
  const fixtures = await getFixtures();

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">Admin control room</span>
          <h1>Results</h1>
          <p className="lede">Confirm full-time scores and the leaderboard recalculates from everyone&apos;s predictions.</p>
        </div>
      </section>

      <AdminResultsPanel fixtures={fixtures} />
    </>
  );
}
