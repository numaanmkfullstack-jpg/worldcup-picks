const flagByCode: Record<string, string> = {
  ALG: "🇩🇿",
  ARG: "🇦🇷",
  AUS: "🇦🇺",
  AUT: "🇦🇹",
  BEL: "🇧🇪",
  BIH: "🇧🇦",
  BRA: "🇧🇷",
  CAN: "🇨🇦",
  CIV: "🇨🇮",
  COD: "🇨🇩",
  CPV: "🇨🇻",
  CRO: "🇭🇷",
  CUW: "🇨🇼",
  CZE: "🇨🇿",
  ECU: "🇪🇨",
  EGY: "🇪🇬",
  ENG: "🏴",
  ESP: "🇪🇸",
  FRA: "🇫🇷",
  GER: "🇩🇪",
  GHA: "🇬🇭",
  HAI: "🇭🇹",
  IRN: "🇮🇷",
  IRQ: "🇮🇶",
  JOR: "🇯🇴",
  JPN: "🇯🇵",
  KOR: "🇰🇷",
  KSA: "🇸🇦",
  MAR: "🇲🇦",
  MEX: "🇲🇽",
  NED: "🇳🇱",
  NOR: "🇳🇴",
  NZL: "🇳🇿",
  PAN: "🇵🇦",
  PAR: "🇵🇾",
  POR: "🇵🇹",
  QAT: "🇶🇦",
  RSA: "🇿🇦",
  SCO: "🏴",
  SEN: "🇸🇳",
  SUI: "🇨🇭",
  SWE: "🇸🇪",
  TUN: "🇹🇳",
  TUR: "🇹🇷",
  URU: "🇺🇾",
  USA: "🇺🇸",
  UZB: "🇺🇿",
};

const flagImageByCode: Record<string, string> = {
  ALG: "https://flagcdn.com/dz.svg",
  ARG: "https://flagcdn.com/ar.svg",
  AUS: "https://flagcdn.com/au.svg",
  AUT: "https://flagcdn.com/at.svg",
  BEL: "https://flagcdn.com/be.svg",
  BIH: "https://flagcdn.com/ba.svg",
  BRA: "https://flagcdn.com/br.svg",
  CAN: "https://flagcdn.com/ca.svg",
  CIV: "https://flagcdn.com/ci.svg",
  COD: "https://flagcdn.com/cd.svg",
  CPV: "https://flagcdn.com/cv.svg",
  CRO: "https://flagcdn.com/hr.svg",
  CUW: "https://flagcdn.com/cw.svg",
  CZE: "https://flagcdn.com/cz.svg",
  ECU: "https://flagcdn.com/ec.svg",
  EGY: "https://flagcdn.com/eg.svg",
  ENG: "https://flagcdn.com/gb-eng.svg",
  ESP: "https://flagcdn.com/es.svg",
  FRA: "https://flagcdn.com/fr.svg",
  GER: "https://flagcdn.com/de.svg",
  GHA: "https://flagcdn.com/gh.svg",
  HAI: "https://flagcdn.com/ht.svg",
  IRN: "https://flagcdn.com/ir.svg",
  IRQ: "https://flagcdn.com/iq.svg",
  JOR: "https://flagcdn.com/jo.svg",
  JPN: "https://flagcdn.com/jp.svg",
  KOR: "https://flagcdn.com/kr.svg",
  KSA: "https://flagcdn.com/sa.svg",
  MAR: "https://flagcdn.com/ma.svg",
  MEX: "https://flagcdn.com/mx.svg",
  NED: "https://flagcdn.com/nl.svg",
  NOR: "https://flagcdn.com/no.svg",
  NZL: "https://flagcdn.com/nz.svg",
  PAN: "https://flagcdn.com/pa.svg",
  PAR: "https://flagcdn.com/py.svg",
  POR: "https://flagcdn.com/pt.svg",
  QAT: "https://flagcdn.com/qa.svg",
  RSA: "https://flagcdn.com/za.svg",
  SCO: "https://flagcdn.com/gb-sct.svg",
  SEN: "https://flagcdn.com/sn.svg",
  SUI: "https://flagcdn.com/ch.svg",
  SWE: "https://flagcdn.com/se.svg",
  TUN: "https://flagcdn.com/tn.svg",
  TUR: "https://flagcdn.com/tr.svg",
  URU: "https://flagcdn.com/uy.svg",
  USA: "https://flagcdn.com/us.svg",
  UZB: "https://flagcdn.com/uz.svg",
};

const codeByTeamName: Record<string, string> = {
  Algeria: "ALG",
  Argentina: "ARG",
  Australia: "AUS",
  Austria: "AUT",
  Belgium: "BEL",
  "Bosnia and Herzegovina": "BIH",
  Brazil: "BRA",
  Canada: "CAN",
  "Cabo Verde": "CPV",
  "Congo DR": "COD",
  "Côte d'Ivoire": "CIV",
  Croatia: "CRO",
  Curaçao: "CUW",
  Czechia: "CZE",
  Ecuador: "ECU",
  Egypt: "EGY",
  England: "ENG",
  France: "FRA",
  Germany: "GER",
  Ghana: "GHA",
  Haiti: "HAI",
  "IR Iran": "IRN",
  Iraq: "IRQ",
  Japan: "JPN",
  Jordan: "JOR",
  "Korea Republic": "KOR",
  Morocco: "MAR",
  Mexico: "MEX",
  Netherlands: "NED",
  "New Zealand": "NZL",
  Norway: "NOR",
  Panama: "PAN",
  Paraguay: "PAR",
  Portugal: "POR",
  Qatar: "QAT",
  "Saudi Arabia": "KSA",
  Scotland: "SCO",
  Senegal: "SEN",
  "South Africa": "RSA",
  Spain: "ESP",
  Switzerland: "SUI",
  Sweden: "SWE",
  Tunisia: "TUN",
  Türkiye: "TUR",
  Uruguay: "URU",
  USA: "USA",
  Uzbekistan: "UZB",
};

export function flagForCode(code: string | null | undefined) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    return "🏆";
  }

  return flagByCode[normalizedCode] ?? "🏆";
}

export function flagImageForCode(code: string | null | undefined) {
  const normalizedCode = normalizeCode(code);

  return normalizedCode ? flagImageByCode[normalizedCode] : undefined;
}

export function codeForTeamName(name: string | null | undefined) {
  if (!name) {
    return null;
  }

  return codeByTeamName[name] ?? null;
}

function normalizeCode(code: string | null | undefined) {
  return code?.trim().toUpperCase() || null;
}
