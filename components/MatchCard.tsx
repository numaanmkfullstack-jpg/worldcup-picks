import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { FlagBadge } from "@/components/FlagBadge";
import type { Fixture } from "@/lib/types";

type MatchCardProps = {
  fixture: Fixture;
  featured?: boolean;
  action?: ReactNode;
};

function stageLabel(stage: Fixture["stage"], groupCode: string | null) {
  if (stage === "group") {
    return `Group ${groupCode}`;
  }

  return stage
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export function MatchCard({ fixture, featured, action }: MatchCardProps) {
  const date = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${fixture.kickoffLocalDate}T12:00:00`));

  return (
    <article className={`match-card ${featured ? "featured" : ""}`}>
      <div className="match-meta">
        <span className="pill">{stageLabel(fixture.stage, fixture.groupCode)}</span>
        <span className="pill">Match {fixture.matchNumber ?? fixture.scheduleOrder}</span>
      </div>

      <div className="team-row">
        <div className="team">
          <FlagBadge code={fixture.homeCode} name={fixture.homeName} />
          <span className="team-name">{fixture.homeName}</span>
        </div>
        <span className="versus">VS</span>
      </div>

      <div className="team-row">
        <div className="team">
          <FlagBadge code={fixture.awayCode} name={fixture.awayName} />
          <span className="team-name">{fixture.awayName}</span>
        </div>
        {fixture.homeScore !== null && fixture.awayScore !== null ? (
          <strong>
            {fixture.homeScore}-{fixture.awayScore}
          </strong>
        ) : null}
      </div>

      <div className="match-meta muted">
        <span className="team">
          <CalendarDays size={16} />
          {date}
        </span>
        <span className="team">
          <MapPin size={16} />
          {fixture.city ?? fixture.venue}
        </span>
      </div>

      {action}
    </article>
  );
}
