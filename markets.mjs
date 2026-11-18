/* The 32 countries of the Samsung Europe subsidiaries. Same codes as welcome/markets.js (UK, not GB).
   fips: GDELT source-country code. iso3: GDACS country code. meteo: MeteoAlarm feed name (Albania is not in MeteoAlarm). */
export const MARKETS = [
  { code: "AL", fips: "AL", iso3: "ALB", meteo: null, en: "Albania" },
  { code: "AT", fips: "AU", iso3: "AUT", meteo: "austria", en: "Austria" },
  { code: "BE", fips: "BE", iso3: "BEL", meteo: "belgium", en: "Belgium" },
  { code: "BA", fips: "BK", iso3: "BIH", meteo: "bosnia-herzegovina", en: "Bosnia and Herzegovina" },
  { code: "BG", fips: "BU", iso3: "BGR", meteo: "bulgaria", en: "Bulgaria" },
  { code: "HR", fips: "HR", iso3: "HRV", meteo: "croatia", en: "Croatia" },
  { code: "CZ", fips: "EZ", iso3: "CZE", meteo: "czechia", en: "Czechia" },
  { code: "DK", fips: "DA", iso3: "DNK", meteo: "denmark", en: "Denmark" },
  { code: "EE", fips: "EN", iso3: "EST", meteo: "estonia", en: "Estonia" },
  { code: "FI", fips: "FI", iso3: "FIN", meteo: "finland", en: "Finland" },
  { code: "FR", fips: "FR", iso3: "FRA", meteo: "france", en: "France" },
  { code: "DE", fips: "GM", iso3: "DEU", meteo: "germany", en: "Germany" },
  { code: "GR", fips: "GR", iso3: "GRC", meteo: "greece", en: "Greece" },
  { code: "HU", fips: "HU", iso3: "HUN", meteo: "hungary", en: "Hungary" },
  { code: "IE", fips: "EI", iso3: "IRL", meteo: "ireland", en: "Ireland" },
  { code: "IT", fips: "IT", iso3: "ITA", meteo: "italy", en: "Italy" },
  { code: "LV", fips: "LG", iso3: "LVA", meteo: "latvia", en: "Latvia" },
  { code: "LT", fips: "LH", iso3: "LTU", meteo: "lithuania", en: "Lithuania" },
  { code: "MK", fips: "MK", iso3: "MKD", meteo: "republic-of-north-macedonia", en: "North Macedonia" },
  { code: "NL", fips: "NL", iso3: "NLD", meteo: "netherlands", en: "Netherlands" },
  { code: "NO", fips: "NO", iso3: "NOR", meteo: "norway", en: "Norway" },
  { code: "PL", fips: "PL", iso3: "POL", meteo: "poland", en: "Poland" },
  { code: "PT", fips: "PO", iso3: "PRT", meteo: "portugal", en: "Portugal" },
  { code: "RO", fips: "RO", iso3: "ROU", meteo: "romania", en: "Romania" },
  { code: "RS", fips: "RI", iso3: "SRB", meteo: "serbia", en: "Serbia" },
  { code: "SK", fips: "LO", iso3: "SVK", meteo: "slovakia", en: "Slovakia" },
  { code: "SI", fips: "SI", iso3: "SVN", meteo: "slovenia", en: "Slovenia" },
  { code: "ES", fips: "SP", iso3: "ESP", meteo: "spain", en: "Spain" },
  { code: "SE", fips: "SW", iso3: "SWE", meteo: "sweden", en: "Sweden" },
  { code: "CH", fips: "SZ", iso3: "CHE", meteo: "switzerland", en: "Switzerland" },
  { code: "UA", fips: "UP", iso3: "UKR", meteo: "ukraine", en: "Ukraine" },
  { code: "UK", fips: "UK", iso3: "GBR", meteo: "united-kingdom", en: "United Kingdom" }
];

export const CODES = MARKETS.map((m) => m.code);
export const CATEGORIES = ["election", "disaster", "strike", "weather", "mourning", "economy", "health"];

/* Optional extra RSS feeds (public broadcasters). Edit freely: a feed that fails is skipped.
   market: the country the feed is about, or null for a pan-European feed (Claude assigns the market). */
export const EXTRA_FEEDS = [
  { name: "BBC News Europe", market: null, url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml" },
  { name: "Tagesschau", market: "DE", url: "https://www.tagesschau.de/index~rss2.xml" },
  { name: "franceinfo", market: "FR", url: "https://www.francetvinfo.fr/titres.rss" }
];
