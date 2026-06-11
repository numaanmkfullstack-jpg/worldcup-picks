import { OrgPanel } from "@/components/OrgPanel";
import { requireUser } from "@/lib/auth";
import { getDefaultOrg } from "@/lib/queries";

export default async function OrgPage() {
  await requireUser();
  const org = await getDefaultOrg();

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">Private leagues</span>
          <h1>Your Org</h1>
          <p className="lede">Create the friend group, invite people, and keep all predictions scoped to your table.</p>
        </div>
      </section>

      <OrgPanel org={org} />
    </>
  );
}
