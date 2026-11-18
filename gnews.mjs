/* Google News search RSS, one request per country in its own language (free, no key, reachable from GitHub).
   Feeds press.mjs: same candidate shape as GDELT (origin "gdelt" is reused so the keyword filter applies unchanged).
   Each item carries <source> with the outlet name, which the "at least 3 outlets" rule counts. */
import { MARKETS } from "./markets.mjs";

/* hl, gl, ceid and the search words (elections OR strike OR mourning) in the main language of each country. */
const GN = {
  AL: ["sq", "AL", "zgjedhje OR grevë OR \"zi kombëtare\""],
  AT: ["de", "AT", "Wahl OR Streik OR Staatstrauer"],
  BE: ["fr", "BE", "élections OR grève OR \"deuil national\""],
  BA: ["bs", "BA", "izbori OR štrajk OR \"dan žalosti\""],
  BG: ["bg", "BG", "избори OR стачка OR траур"],
  HR: ["hr", "HR", "izbori OR štrajk OR \"dan žalosti\""],
  CZ: ["cs", "CZ", "volby OR stávka OR \"státní smutek\""],
  DK: ["da", "DK", "valg OR strejke OR landesorg"],
  EE: ["et", "EE", "valimised OR streik OR leinapäev"],
  FI: ["fi", "FI", "vaalit OR lakko OR suruliputus"],
  FR: ["fr", "FR", "élections OR grève OR \"deuil national\""],
  DE: ["de", "DE", "Wahl OR Streik OR Staatstrauer"],
  GR: ["el", "GR", "εκλογές OR απεργία OR πένθος"],
  HU: ["hu", "HU", "választás OR sztrájk OR gyász"],
  IE: ["en", "IE", "election OR strike OR \"national mourning\""],
  IT: ["it", "IT", "elezioni OR sciopero OR \"lutto nazionale\""],
  LV: ["lv", "LV", "vēlēšanas OR streiks OR sēru"],
  LT: ["lt", "LT", "rinkimai OR streikas OR gedulo"],
  MK: ["mk", "MK", "избори OR штрајк OR жалост"],
  NL: ["nl", "NL", "verkiezingen OR staking OR \"nationale rouw\""],
  NO: ["no", "NO", "valg OR streik OR landesorg"],
  PL: ["pl", "PL", "wybory OR strajk OR żałoba"],
  PT: ["pt-PT", "PT", "eleições OR greve OR \"luto nacional\""],
  RO: ["ro", "RO", "alegeri OR grevă OR doliu"],
  RS: ["sr", "RS", "izbori OR štrajk OR žalost"],
  SK: ["sk", "SK", "voľby OR štrajk OR smútok"],
  SI: ["sl", "SI", "volitve OR stavka OR žalovanja"],
  ES: ["es", "ES", "elecciones OR huelga OR \"luto oficial\""],
  SE: ["sv", "SE", "val OR strejk OR landssorg"],
  CH: ["de", "CH", "Wahl OR Streik OR Abstimmung"],
  UA: ["uk", "UA", "вибори OR страйк OR жалоба"],
  UK: ["en-GB", "GB", "election OR strike OR \"national mourning\""]
};

export async function gnews(log, { get, items, tag, iso, sleep, pauseMs = 1500, perMarket = 60 } = {}) {
  const out = [];
  for (const m of MARKETS) {
    const [hl, gl, words] = GN[m.code];
    const lang = hl.split("-")[0];
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`(${words}) when:2d`)}&hl=${hl}&gl=${gl}&ceid=${gl}:${lang}`;
    try {
      const list = items(await get(url)).slice(0, perMarket);
      for (const it of list) {
        const source = tag(it, "source") || "Google News";
        const title = tag(it, "title").replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
        out.push({ market: m.code, source, title, url: tag(it, "link"), publishedAt: iso(tag(it, "pubDate")), origin: "gdelt" });
      }
      log(`Google News ${m.code}: ${list.length}`);
    } catch (e) {
      log(`Google News ${m.code} skipped: ${e.message}`);
    }
    await sleep(pauseMs);
  }
  return out;
}
