const defaultFifaResultsUrl =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures";

type ScrapedScore = {
  homeScore: number;
  awayScore: number;
  sourceUrl: string;
  matchedText: string;
};

function htmlToSearchableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/turkiye/gi, "turkiye")
    .replace(/cote d'ivoire/gi, "cote d'ivoire")
    .toLowerCase();
}

function scoreLooksLikeKickoff(rawHome: string, rawAway: string) {
  // FIFA fixture text includes kickoff times like 01:00 or 19:00. These are not scores.
  if ((rawHome.length > 1 && rawHome.startsWith("0")) || (rawAway.length > 1 && rawAway.startsWith("0"))) {
    return true;
  }

  const home = Number(rawHome);
  const away = Number(rawAway);

  return home > 15 || away > 15;
}

function extractScoreFromWindow(windowText: string) {
  const candidates = Array.from(windowText.matchAll(/(?:^|\D)(\d{1,2})\s*[-:]\s*(\d{1,2})(?:\D|$)/g));

  for (const candidate of candidates) {
    const [, rawHome, rawAway] = candidate;
    if (!rawHome || !rawAway || scoreLooksLikeKickoff(rawHome, rawAway)) {
      continue;
    }

    return {
      homeScore: Number(rawHome),
      awayScore: Number(rawAway),
    };
  }

  return null;
}

export async function scrapeFifaResult(homeName: string, awayName: string): Promise<ScrapedScore | null> {
  const sourceUrl = process.env.RESULTS_SCRAPE_URL || defaultFifaResultsUrl;
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "WorldCupPicks/1.0 result checker",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`FIFA result source returned ${response.status}`);
  }

  const html = await response.text();
  const text = htmlToSearchableText(html);
  const normalizedText = normalize(text);
  const normalizedHome = normalize(homeName);
  const normalizedAway = normalize(awayName);
  const homeIndex = normalizedText.indexOf(normalizedHome);

  if (homeIndex === -1) {
    return null;
  }

  const awayIndex = normalizedText.indexOf(normalizedAway, homeIndex);
  if (awayIndex === -1 || awayIndex - homeIndex > 420) {
    return null;
  }

  const windowStart = Math.max(0, homeIndex - 120);
  const windowEnd = Math.min(text.length, awayIndex + awayName.length + 160);
  const matchedText = text.slice(windowStart, windowEnd);
  const score = extractScoreFromWindow(matchedText);

  if (!score) {
    return null;
  }

  return {
    ...score,
    sourceUrl,
    matchedText,
  };
}
