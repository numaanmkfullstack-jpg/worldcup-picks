type EspnScore = {
  homeScore: number;
  awayScore: number;
  sourceUrl: string;
  matchedText: string;
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: {
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
  };
};

type EspnEvent = {
  id?: string;
  name?: string;
  shortName?: string;
  status?: {
    type?: {
      completed?: boolean;
      state?: string;
      detail?: string;
      shortDetail?: string;
    };
  };
  competitions?: Array<{
    competitors?: EspnCompetitor[];
  }>;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameTeam(competitor: EspnCompetitor, name: string, code: string | null | undefined) {
  const wantedName = normalize(name);
  const wantedCode = normalize(code);
  const displayName = normalize(competitor.team?.displayName);
  const shortName = normalize(competitor.team?.shortDisplayName);
  const abbreviation = normalize(competitor.team?.abbreviation);

  return (
    displayName === wantedName ||
    shortName === wantedName ||
    (Boolean(wantedCode) && abbreviation === wantedCode)
  );
}

function dateForEspn(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00Z`);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export async function scrapeEspnResult(params: {
  homeName: string;
  awayName: string;
  homeCode: string | null;
  awayCode: string | null;
  kickoffLocalDate: string | Date;
}): Promise<EspnScore | null> {
  const date = dateForEspn(params.kickoffLocalDate);
  const sourceUrl = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${date}`;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "WorldCupPicks/1.0 ESPN result checker",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`ESPN scoreboard returned ${response.status}`);
  }

  const payload = (await response.json()) as { events?: EspnEvent[] };
  for (const event of payload.events ?? []) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((competitor) => sameTeam(competitor, params.homeName, params.homeCode));
    const away = competitors.find((competitor) => sameTeam(competitor, params.awayName, params.awayCode));

    if (!home || !away || !event.status?.type?.completed) {
      continue;
    }

    const homeScore = Number(home.score);
    const awayScore = Number(away.score);
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      continue;
    }

    return {
      homeScore,
      awayScore,
      sourceUrl,
      matchedText: `${event.name ?? event.shortName ?? "ESPN match"} ${homeScore}-${awayScore}`,
    };
  }

  return null;
}
