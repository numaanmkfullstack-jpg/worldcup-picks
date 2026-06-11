type SearchScore = {
  homeScore: number;
  awayScore: number;
  sourceUrl: string;
  matchedText: string;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'");
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreLooksPlausible(homeScore: number, awayScore: number) {
  return homeScore >= 0 && awayScore >= 0 && homeScore <= 15 && awayScore <= 15;
}

function parseBingRssItems(xml: string) {
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  return items.map((item) => {
    const itemXml = item[1] ?? "";
    const title = decodeXml(itemXml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const description = decodeXml(itemXml.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "");
    const link = decodeXml(itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "");

    return {
      text: stripTags(`${title}. ${description}`),
      link,
    };
  });
}

function findScoreInText(text: string, homeName: string, awayName: string) {
  const normalizedText = normalize(text);
  const normalizedHome = normalize(homeName);
  const normalizedAway = normalize(awayName);

  if (!normalizedText.includes(normalizedHome) || !normalizedText.includes(normalizedAway)) {
    return null;
  }

  const homeThenAway = new RegExp(
    `${escapeRegex(normalizedHome)}[^\\d]{0,80}(\\d{1,2})\\s*[-:]\\s*(\\d{1,2})[^a-z0-9]{0,80}${escapeRegex(normalizedAway)}`,
    "i",
  );
  const awayThenHome = new RegExp(
    `${escapeRegex(normalizedAway)}[^\\d]{0,80}(\\d{1,2})\\s*[-:]\\s*(\\d{1,2})[^a-z0-9]{0,80}${escapeRegex(normalizedHome)}`,
    "i",
  );
  const homePrefix = new RegExp(`${escapeRegex(normalizedHome)}[^\\d]{0,80}(\\d{1,2})\\s*[-:]\\s*(\\d{1,2})`, "i");
  const awayPrefix = new RegExp(`${escapeRegex(normalizedAway)}[^\\d]{0,80}(\\d{1,2})\\s*[-:]\\s*(\\d{1,2})`, "i");
  const scoreNearBothTeams = /(\d{1,2})\s*[-:]\s*(\d{1,2})/g;

  const directHome = normalizedText.match(homeThenAway);
  if (directHome) {
    const homeScore = Number(directHome[1]);
    const awayScore = Number(directHome[2]);
    return scoreLooksPlausible(homeScore, awayScore) ? { homeScore, awayScore } : null;
  }

  const directAway = normalizedText.match(awayThenHome);
  if (directAway) {
    const awayScore = Number(directAway[1]);
    const homeScore = Number(directAway[2]);
    return scoreLooksPlausible(homeScore, awayScore) ? { homeScore, awayScore } : null;
  }

  const homeMatch = normalizedText.match(homePrefix);
  if (homeMatch && normalizedText.indexOf(normalizedAway) > normalizedText.indexOf(homeMatch[0])) {
    const homeScore = Number(homeMatch[1]);
    const awayScore = Number(homeMatch[2]);
    return scoreLooksPlausible(homeScore, awayScore) ? { homeScore, awayScore } : null;
  }

  const awayMatch = normalizedText.match(awayPrefix);
  if (awayMatch && normalizedText.indexOf(normalizedHome) > normalizedText.indexOf(awayMatch[0])) {
    const awayScore = Number(awayMatch[1]);
    const homeScore = Number(awayMatch[2]);
    return scoreLooksPlausible(homeScore, awayScore) ? { homeScore, awayScore } : null;
  }

  for (const score of normalizedText.matchAll(scoreNearBothTeams)) {
    const scoreIndex = score.index ?? 0;
    const windowStart = Math.max(0, scoreIndex - 100);
    const windowEnd = Math.min(normalizedText.length, scoreIndex + 100);
    const scoreWindow = normalizedText.slice(windowStart, windowEnd);

    if (!scoreWindow.includes(normalizedHome) || !scoreWindow.includes(normalizedAway)) {
      continue;
    }

    const homeScore = Number(score[1]);
    const awayScore = Number(score[2]);
    if (scoreLooksPlausible(homeScore, awayScore)) {
      return { homeScore, awayScore };
    }
  }

  return null;
}

export async function scrapeSearchResult(homeName: string, awayName: string): Promise<SearchScore | null> {
  const query = `${homeName} ${awayName} World Cup 2026 final score`;
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "WorldCupPicks/1.0 result search",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Search fallback returned ${response.status}`);
  }

  const xml = await response.text();
  const items = parseBingRssItems(xml);

  for (const item of items) {
    const score = findScoreInText(item.text, homeName, awayName);
    if (!score) {
      continue;
    }

    return {
      ...score,
      sourceUrl: item.link || url,
      matchedText: item.text,
    };
  }

  return null;
}
