import { PredictionPanel } from "@/components/PredictionPanel";
import { requireUser } from "@/lib/auth";
import { getDefaultOrg, getFixtures, getUserPredictions } from "@/lib/queries";

export default async function PredictPage() {
  const user = await requireUser();
  const [fixtures, org, predictions] = await Promise.all([
    getFixtures(),
    getDefaultOrg(),
    user.organizationId ? getUserPredictions(user.organizationId, user.id) : [],
  ]);

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">Matchday room</span>
          <h1>Predict</h1>
          <p className="lede">Pick a match, call the score, and submit it to your org before kickoff.</p>
        </div>
      </section>

      <PredictionPanel fixtures={fixtures} org={org} predictions={predictions} />
    </>
  );
}
