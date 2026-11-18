/* Free mode, no AI: turns official alerts (GDACS disasters, MeteoAlarm orange/red weather warnings) into feed items
   with fixed Spanish and English wording. It never covers elections, strikes or mourning: those need the AI mode. */
import { createHash } from "node:crypto";

const ES = { AL: "Albania", AT: "Austria", BE: "Bélgica", BA: "Bosnia", BG: "Bulgaria", HR: "Croacia", CZ: "Chequia", DK: "Dinamarca",
  EE: "Estonia", FI: "Finlandia", FR: "Francia", DE: "Alemania", GR: "Grecia", HU: "Hungría", IE: "Irlanda", IT: "Italia", LV: "Letonia",
  LT: "Lituania", MK: "Macedonia del Norte", NL: "Países Bajos", NO: "Noruega", PL: "Polonia", PT: "Portugal", RO: "Rumanía", RS: "Serbia",
  SK: "Eslovaquia", SI: "Eslovenia", ES: "España", SE: "Suecia", CH: "Suiza", UA: "Ucrania", UK: "Reino Unido" };
const EN = { BA: "Bosnia", MK: "North Macedonia", CZ: "Czechia", UK: "the United Kingdom", NL: "the Netherlands" };

const WEATHER = {
  thunderstorm: ["tormentas fuertes", "severe thunderstorms"], wind: ["viento fuerte", "strong winds"], rain: ["lluvias intensas", "heavy rain"],
  flood: ["inundaciones", "flooding"], snow: ["nieve y hielo", "snow and ice"], heat: ["calor extremo", "extreme heat"],
  cold: ["frío extremo", "extreme cold"], fire: ["riesgo de incendios forestales", "wildfire risk"], coastal: ["temporal costero", "coastal storms"],
  avalanche: ["riesgo de aludes", "avalanche risk"], fog: ["niebla densa", "dense fog"], other: ["fenómenos adversos", "severe weather"]
};
const DISASTER = {
  EQ: ["Terremoto", "Earthquake"], FL: ["Inundaciones", "Floods"], TC: ["Ciclón", "Cyclone"], VO: ["Erupción volcánica", "Volcanic eruption"],
  WF: ["Incendio forestal", "Wildfire"], DR: ["Sequía", "Drought"]
};

/* "de España", but "del Reino Unido" and "de los Países Bajos". */
function deEs(code) { return code === "UK" ? "del Reino Unido" : code === "NL" ? "de los Países Bajos" : `de ${ES[code]}`; }
function clip(s, n) { return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; }
function id(market, key) { return `${market}-${createHash("sha1").update(key).digest("hex").slice(0, 12)}`; }
function countryEn(code, fallback) { return EN[code] || fallback; }

function weatherItem(c, enName) {
  const [hEs, hEn] = WEATHER[c.hazard] || WEATHER.other;
  const red = c.level === "red";
  const one = c.areas.length === 1 ? c.areas[0] : null;
  const whereEs = one ? `en ${one}` : `en ${c.areas.length} zonas ${deEs(c.market)}`;
  const whereEn = one ? `in ${one}` : `in ${c.areas.length} areas of ${countryEn(c.market, enName)}`;
  const heat = c.hazard === "heat" || c.hazard === "fire";
  return {
    id: id(c.market, `meteo|${c.hazard}|${c.level}|${c.onset.slice(0, 10)}`),
    market: c.market,
    category: c.hazard === "fire" ? "disaster" : "weather",
    title: { es: clip(`Aviso ${red ? "rojo" : "naranja"} por ${hEs} ${whereEs}`, 90), en: clip(`${red ? "Red" : "Orange"} warning for ${hEn} ${whereEn}`, 90) },
    note: red
      ? { es: "Pausa mensajes alegres o de exterior en la zona y prevé retrasos en entregas.", en: "Pause upbeat or outdoor messaging in the area and expect delivery delays." }
      : heat
        ? { es: "Evita mensajes de calor, verano o exterior en la zona estos días.", en: "Avoid heat, summer or outdoor messaging in the area for now." }
        : { es: "Revisa piezas de exterior en la zona y prevé posibles retrasos.", en: "Review outdoor content in the area and allow for possible delays." },
    source: "MeteoAlarm",
    url: c.url,
    publishedAt: c.publishedAt,
    sample: false
  };
}

function disasterItem(c, enName) {
  const [tEs, tEn] = DISASTER[c.hazard] || ["Emergencia", "Emergency"];
  const red = c.level === "red";
  return {
    id: id(c.market, c.url),
    market: c.market,
    category: "disaster",
    title: { es: `${tEs} en ${c.market === "UK" ? "el Reino Unido" : c.market === "NL" ? "los Países Bajos" : ES[c.market]}: alerta ${red ? "roja" : "naranja"}`, en: `${tEn} in ${countryEn(c.market, enName)}: ${red ? "red" : "orange"} alert` },
    note: { es: "Pausa o revisa contenidos alegres programados para la zona afectada.", en: "Pause or review upbeat content scheduled for the affected area." },
    source: "GDACS",
    url: c.url,
    publishedAt: c.publishedAt,
    sample: false
  };
}

/* Keeps at most maxPerMarket per country: red before orange, disasters before weather, more areas first. */
export function selectFree(candidates, markets, maxPerMarket = 2) {
  const en = Object.fromEntries(markets.map((m) => [m.code, m.en]));
  const rank = (c) => (c.level === "red" ? 0 : 2) + (c.origin === "gdacs" ? 0 : 1);
  const per = {};
  return candidates
    .filter((c) => c.market && (c.origin === "gdacs" || c.origin === "meteoalarm"))
    .sort((a, b) => rank(a) - rank(b) || (b.areas?.length || 0) - (a.areas?.length || 0))
    .filter((c) => (per[c.market] = (per[c.market] || 0) + 1) <= maxPerMarket)
    .map((c) => (c.origin === "gdacs" ? disasterItem(c, en[c.market]) : weatherItem(c, en[c.market])));
}
