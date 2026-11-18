/* Candidate headlines from free sources without keys. Every source is optional: a failure is logged and skipped.
   Candidate shape: { id, market|null, source, title, url, publishedAt, origin: "gdacs"|"gdelt"|"rss"|"previous", extra? } */
import { MARKETS } from "./markets.mjs";

const UA = "CheilCoEHub-NewsJob/1.0";
/* How many source requests answered and failed in this run, so the job can tell "all quiet" from "nothing reachable". */
export const stats = { ok: 0, failed: 0 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { timeout = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    stats.ok++;
    return text;
  } catch (e) {
    stats.failed++;
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/* Minimal RSS reader: enough for RSS 2.0 <item> lists, no dependency. */
function decode(s) {
  return String(s || "")
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}
function items(xml) {
  return xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
}
function iso(date) {
  const d = new Date(date);
  return isNaN(d) ? new Date().toISOString() : d.toISOString();
}

/* GDACS (EU/UN disaster alerts). Keeps orange and red alerts in our countries. */
export async function gdacs(log) {
  const byIso3 = Object.fromEntries(MARKETS.map((m) => [m.iso3, m.code]));
  try {
    const xml = await get("https://www.gdacs.org/xml/rss.xml");
    const out = [];
    for (const it of items(xml)) {
      const level = tag(it, "gdacs:alertlevel");
      if (!/orange|red/i.test(level)) continue;
      const iso3s = tag(it, "gdacs:iso3").split(/[,;\s]+/).filter(Boolean);
      for (const code of iso3s.map((c) => byIso3[c]).filter(Boolean)) {
        out.push({ market: code, source: "GDACS", title: `${level} alert: ${tag(it, "title")}`, url: tag(it, "link"),
          publishedAt: iso(tag(it, "pubDate")), origin: "gdacs", extra: tag(it, "description").slice(0, 300),
          level: /red/i.test(level) ? "red" : "orange", hazard: tag(it, "gdacs:eventtype") });
      }
    }
    log(`GDACS: ${out.length} alerts`);
    return out;
  } catch (e) {
    log(`GDACS skipped: ${e.message}`);
    return [];
  }
}

/* GDELT DOC 2.0: local press of each country, last 36 h, only the themes that matter.
   GDELT translates 65 languages, so English keywords also match local-language articles.
   GDELT asks for one request every 5 seconds. */
const THEMES = '(election OR elections OR referendum OR strike OR strikes OR walkout OR wildfire OR flood OR earthquake OR storm OR "red alert" OR "state of emergency" OR mourning OR blackout OR outbreak OR "government collapse")';

/* GDELT asks for at most one request every 5 seconds per address, and GitHub runners share addresses, so one request
   per country gets throttled. Countries go in small groups (one request each), with a retry after a pause when throttled.
   Each article says its source country by name, which maps it back to our code. */
const GDELT_NAMES = { "czech republic": "CZ", czechia: "CZ", macedonia: "MK", "north macedonia": "MK", "bosnia and herzegovina": "BA",
  "bosnia-herzegovina": "BA", bosnia: "BA", "united kingdom": "UK", uk: "UK", "great britain": "UK", netherlands: "NL", "the netherlands": "NL" };
function gdeltCode(name) {
  const n = String(name || "").toLowerCase().trim();
  if (GDELT_NAMES[n]) return GDELT_NAMES[n];
  const m = MARKETS.find((x) => x.en.toLowerCase() === n);
  return m ? m.code : null;
}

export async function gdelt(log, { groupSize = 4, perGroup = 250, pauseMs = 8000, retries = 3 } = {}) {
  const out = [];
  const groups = [];
  for (let i = 0; i < MARKETS.length; i += groupSize) groups.push(MARKETS.slice(i, i + groupSize));
  for (const g of groups) {
    const countries = g.map((m) => `sourcecountry:${m.fips}`).join(" OR ");
    const q = encodeURIComponent(`(${countries}) ${THEMES}`);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&sort=hybridrel&timespan=36h&maxrecords=${perGroup}`;
    const label = g.map((m) => m.code).join(",");
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const text = await get(url, { timeout: 45000 });
        const arts = JSON.parse(text).articles || [];
        const counts = {}, unknown = new Set();
        for (const a of arts) {
          const code = gdeltCode(a.sourcecountry);
          if (!code) unknown.add(a.sourcecountry);
          if (!code || !g.some((m) => m.code === code)) continue;
          counts[code] = (counts[code] || 0) + 1;
          out.push({ market: code, source: a.domain, title: decode(a.title), url: a.url,
            publishedAt: iso(String(a.seendate || "").replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/, "$1-$2-$3T$4:$5:$6Z")), origin: "gdelt" });
        }
        log(`GDELT ${label}: ${arts.length} articles (${Object.entries(counts).map(([k, v]) => k + " " + v).join(", ") || "none mapped"})${unknown.size ? "; unknown countries: " + [...unknown].join(", ") : ""}`);
        break;
      } catch (e) {
        log(`GDELT ${label} attempt ${attempt} failed: ${e.message}`);
        if (attempt < retries) await sleep(pauseMs * attempt * 2);
      }
    }
    await sleep(pauseMs);
  }
  return out;
}

export async function rss(log, feeds, { perFeed = 30 } = {}) {
  const out = [];
  for (const f of feeds) {
    try {
      const list = items(await get(f.url)).slice(0, perFeed);
      for (const it of list) {
        out.push({ market: f.market, source: f.name, title: tag(it, "title"), url: tag(it, "link"),
          publishedAt: iso(tag(it, "pubDate") || tag(it, "dc:date")), origin: "rss", extra: tag(it, "description").slice(0, 200) });
      }
      log(`RSS ${f.name}: ${list.length}`);
    } catch (e) {
      log(`RSS ${f.name} skipped: ${e.message}`);
    }
  }
  return out;
}

/* Drops duplicates (same url or same title in the same market), old items, and numbers what is left. */
export function tidy(list, { maxAgeHours = 48 } = {}) {
  const seen = new Set();
  const cutoff = Date.now() - maxAgeHours * 36e5;
  return list
    .filter((c) => c.title && c.url && (c.origin === "previous" || new Date(c.publishedAt).getTime() >= cutoff))
    .filter((c) => {
      const k1 = c.origin === "meteoalarm" ? c.title : c.url, k2 = `${c.market}|${c.title.toLowerCase()}`;
      if (seen.has(k1) || seen.has(k2)) return false;
      seen.add(k1); seen.add(k2);
      return true;
    })
    .map((c, i) => ({ ...c, id: `c${i + 1}` }));
}

/* MeteoAlarm (European weather services, CC BY 4.0): orange and red warnings in force or starting in the next 36 h.
   One entry per area and warning, so they are grouped into one candidate per country, hazard and level. */
const HAZARDS = [
  ["thunderstorm", /thunder/i], ["wind", /wind|gale|storm|gust/i], ["rain", /rain|precipitation/i], ["flood", /flood/i],
  ["snow", /snow|ice|icing|freez/i], ["heat", /heat|high.temp/i], ["cold", /cold|low.temp/i], ["fire", /fire/i],
  ["coastal", /coast|wave|sea/i], ["avalanche", /avalanche/i], ["fog", /fog/i]
];
function hazardOf(text) {
  for (const [k, re] of HAZARDS) if (re.test(text)) return k;
  return "other";
}

export async function meteoalarm(log, { pauseMs = 300, horizonHours = 36 } = {}) {
  const out = [];
  const now = Date.now(), horizon = now + horizonHours * 36e5;
  for (const m of MARKETS.filter((x) => x.meteo)) {
    try {
      const xml = await get(`https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${m.meteo}`);
      const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
      const groups = new Map();
      for (const e of entries) {
        const sev = tag(e, "cap:severity");
        if (!/severe|extreme/i.test(sev)) continue;
        if (/cancel/i.test(tag(e, "cap:message_type"))) continue;
        const onset = new Date(tag(e, "cap:onset") || tag(e, "cap:effective")).getTime();
        const expires = new Date(tag(e, "cap:expires")).getTime();
        if (expires && expires < now) continue;
        if (onset && onset > horizon) continue;
        const level = /extreme/i.test(sev) ? "red" : "orange";
        const title = tag(e, "title"), event = tag(e, "cap:event");
        const hazard = hazardOf(`${(title.match(/(?:yellow|orange|red)\s+(.+?)\s+warning/i) || [])[1] || ""} ${event}`);
        const key = `${hazard}|${level}`;
        const g = groups.get(key) || { areas: new Set(), onset: Infinity, expires: 0, event };
        g.areas.add(tag(e, "cap:areaDesc"));
        g.onset = Math.min(g.onset, onset || now);
        g.expires = Math.max(g.expires, expires || 0);
        groups.set(key, g);
      }
      for (const [key, g] of groups) {
        const [hazard, level] = key.split("|");
        const areas = [...g.areas].filter(Boolean);
        out.push({ market: m.code, source: "MeteoAlarm", origin: "meteoalarm", hazard, level, areas,
          onset: new Date(g.onset).toISOString(), expires: g.expires ? new Date(g.expires).toISOString() : null,
          title: `${level} ${hazard} warning in ${m.en}: ${areas.length} areas (${areas.slice(0, 4).join(", ")})`,
          url: "https://meteoalarm.org", publishedAt: new Date(Math.min(g.onset, now)).toISOString(),
          extra: g.event });
      }
      log(`MeteoAlarm ${m.code}: ${groups.size} orange/red warnings`);
    } catch (e) {
      log(`MeteoAlarm ${m.code} skipped: ${e.message}`);
    }
    await sleep(pauseMs);
  }
  return out;
}
