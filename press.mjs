/* Free press mode, no AI: from local-press headlines (Google News per country) (original language), keeps at most one per country
   when a topic that matters (elections, strikes, official mourning) is covered by several different outlets.
   Headlines are not translated: the app shows them as published, with the category in Spanish or English.
   It is a keyword filter, so some noise can get through; the AI mode is the one that really judges. */
import { createHash } from "node:crypto";

/* Word beginnings in the 25 languages of our markets. Matched at the start of a word, case-insensitive. */
const TOPICS = {
  election: ["elecci", "electoral", "eleiç", "eleitor", "elezion", "élection", "électoral", "wahl", "neuwahl", "bundestagswahl", "landtagswahl", "kommunalwahl",
    "verkiezing", "election", "referend", "wybor", "volby", "voleb", "választás", "alegeri", "избори", "izbori", "volitv", "εκλογ",
    "δημοψήφισμ", "zgjedhj", "valimis", "vēlēšan", "rinkim", "folketingsvalg", "stortingsvalg", "riksdagsval", "kommunalval", "valet", "valrörelse", "valget", "valg", "voľb", "valimised", "vaali",
    "вибор", "референдум", "snap poll", "parlamentsvalg", "kommunevalg"],
  strike: ["huelga", "greve", "sciopero", "grève", "streik", "warnstreik", "staking", "strike", "strajk", "stávk", "sztrájk", "grevă",
    "стачк", "štrajk", "stavk", "штрајк", "strejk", "streiks", "streik", "lakko", "страйк", "страйк"],
  mourning: ["luto", "lutto", "deuil", "staatstrauer", "landestrauer", "nationale rouw", "national mourning", "żałob", "státní smutek",
    "štátny smútok", "gyász", "doliu", "траур", "dan žalosti", "dan žalovanja", "πένθος", "zi kombëtare", "leinapäev", "sēru", "gedulo",
    "landesorg", "landssorg", "suruliput", "жалоба", "жалост", "žalost", "žalovan", "smútok"]
};
/* Headlines that share those words but are not what we want. */
const NOISE = ["hambre", "fome", "fame", "faim", "hunger", "głodow", "hlad", "éhség", "foame", "глад", "πείνα", "nälkä", "голод",
  "fútbol", "futbol", "futebol", "football", "calcio", "fußball", "voetbal", "piłk", "fotbal", "labdarúg", "nogomet", "ποδόσφ",
  "jalgpall", "futbols", "fodbold", "fotball", "fotboll", "jalkapallo", "футбол", "liga", "champions", "tennis", "nba", "olymp",
  "eurovision", "miss ", "reality", "trump", "biden", "white house", "casa blanca", "maison blanche", "weißen haus", "usa", "eeuu",
  "estados unidos", "états-unis", "stati uniti"];

function words(s) { return " " + s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ") + " "; }
function has(text, list) { return list.some((w) => text.includes(" " + w.toLowerCase())); }

export function selectPress(candidates, { minOutlets = 3 } = {}) {
  const out = [];
  const byMarket = {};
  for (const c of candidates) if (c.origin === "gdelt" && c.market) (byMarket[c.market] = byMarket[c.market] || []).push(c);
  for (const [market, list] of Object.entries(byMarket)) {
    let best = null;
    for (const [topic, stems] of Object.entries(TOPICS)) {
      const hits = list.filter((c) => { const w = words(c.title); return has(w, stems) && !has(w, NOISE); });
      const outlets = new Set(hits.map((c) => c.source));
      if (outlets.size >= minOutlets && (!best || outlets.size > best.outlets)) best = { topic, outlets: outlets.size, first: hits[0] };
    }
    if (!best) continue;
    const c = best.first; // GDELT sorts by relevance, so the first hit is the most representative headline
    out.push({
      id: `${market}-${createHash("sha1").update(c.url).digest("hex").slice(0, 12)}`,
      market,
      category: best.topic,
      title: { es: c.title, en: c.title },
      note: { es: `Tema en ${best.outlets} medios. Titular original; abre la noticia para ver el detalle.`,
              en: `Covered by ${best.outlets} outlets. Original headline; open the story for details.` },
      source: c.source,
      url: c.url,
      publishedAt: c.publishedAt,
      original: true,
      sample: false
    });
  }
  return out;
}
