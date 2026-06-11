import Link from "next/link";
import { MatchCard } from "@/components/MatchCard";
import { getFixtures } from "@/lib/queries";

export default async function FixturesPage() {
  const fixtures = await getFixtures();

  return (
    <>
      <section className="page-heading section">
        <div>
          <span className="eyebrow">FIFA-sourced schedule</span>
          <h1>Fixtures</h1>
          <p className="lede">Browse the tournament calendar, flags, venues, group labels, and knockout placeholders.</p>
        </div>
        <Link className="button" href="/predict">
          Predict a match
        </Link>
      </section>

      <section className="grid">
        {fixtures.map((fixture) => (
          <MatchCard
            key={fixture.id}
            fixture={fixture}
            action={
              <Link className="ghost-button" href={`/predict?match=${fixture.id}`}>
                Pick score
              </Link>
            }
          />
        ))}
      </section>
    </>
  );
}
