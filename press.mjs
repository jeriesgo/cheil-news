/* Free press mode, no AI: from local-press headlines (Google News per country) (original language), keeps at most one per country
   when one story about a topic that matters (elections, strikes, official mourning) is covered by 3+ different outlets.
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
  "estados unidos", "états-unis", "stati uniti", "nsfw", "hentai", "casino", "porn", "bonus", "free spins", "darmowe gry"];

function words(s) { return " " + s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ") + " "; }
function has(text, list) { return list.some((w) => text.includes(" " + w.toLowerCase())); }

/* Significant words of a headline: 4+ letters, not a topic word, not a number. Two headlines about the same story
   share at least two of them (names, places, sectors), while unrelated headlines that only share "strike" do not. */
function keyWords(title, stems) {
  return new Set(words(title).trim().split(" ").filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !stems.some((st) => w.startsWith(st.toLowerCase()))));
}

/* Groups headlines into stories (two headlines are the same story when they share 2+ significant words). */
function stories(hits, stems) {
  const keys = hits.map((c) => keyWords(c.title, stems));
  const group = hits.map((_, i) => i);
  const find = (i) => (group[i] === i ? i : (group[i] = find(group[i])));
  for (let i = 0; i < hits.length; i++)
    for (let j = i + 1; j < hits.length; j++) {
      let shared = 0;
      for (const w of keys[i]) if (keys[j].has(w) && ++shared >= 2) break;
      if (shared >= 2) group[find(j)] = find(i);
    }
  const out = new Map();
  hits.forEach((c, i) => { const g = find(i); (out.get(g) || out.set(g, []).get(g)).push(c); });
  return [...out.values()];
}

export function selectPress(candidates, { minOutlets = 3 } = {}) {
  const out = [];
  const byMarket = {};
  const allStems = Object.values(TOPICS).flat();
  for (const c of candidates) if (c.origin === "gdelt" && c.market) (byMarket[c.market] = byMarket[c.market] || []).push(c);
  for (const [market, list] of Object.entries(byMarket)) {
    let best = null;
    for (const [topic, stems] of Object.entries(TOPICS)) {
      const hits = list.filter((c) => { const w = words(c.title); return has(w, stems) && !has(w, NOISE); });
      for (const story of stories(hits, allStems)) {
        const outlets = new Set(story.map((c) => c.source)).size;
        if (outlets >= minOutlets && (!best || outlets > best.outlets)) best = { topic, outlets, first: story[0] };
      }
    }
    if (!best) continue;
    const c = best.first; // results come by relevance, so the first headline of the story is the most representative
    out.push({
      id: `${market}-${createHash("sha1").update(c.url).digest("hex").slice(0, 12)}`,
      market,
      category: best.topic,
      title: { es: c.title, en: c.title },
      note: { es: `Noticia en ${best.outlets} medios. Titular original; abre la noticia para ver el detalle.`,
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
