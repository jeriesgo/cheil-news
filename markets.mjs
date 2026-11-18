/* The 32 countries of the Samsung Europe subsidiaries. Same codes as welcome/markets.js (UK, not GB).
   fips: GDELT source-country code. iso3: GDACS country code. */
export const MARKETS = [
  { code: "AL", fips: "AL", iso3: "ALB", en: "Albania" },
  { code: "AT", fips: "AU", iso3: "AUT", en: "Austria" },
  { code: "BE", fips: "BE", iso3: "BEL", en: "Belgium" },
  { code: "BA", fips: "BK", iso3: "BIH", en: "Bosnia and Herzegovina" },
  { code: "BG", fips: "BU", iso3: "BGR", en: "Bulgaria" },
  { code: "HR", fips: "HR", iso3: "HRV", en: "Croatia" },
  { code: "CZ", fips: "EZ", iso3: "CZE", en: "Czechia" },
  { code: "DK", fips: "DA", iso3: "DNK", en: "Denmark" },
  { code: "EE", fips: "EN", iso3: "EST", en: "Estonia" },
  { code: "FI", fips: "FI", iso3: "FIN", en: "Finland" },
  { code: "FR", fips: "FR", iso3: "FRA", en: "France" },
  { code: "DE", fips: "GM", iso3: "DEU", en: "Germany" },
  { code: "GR", fips: "GR", iso3: "GRC", en: "Greece" },
  { code: "HU", fips: "HU", iso3: "HUN", en: "Hungary" },
  { code: "IE", fips: "EI", iso3: "IRL", en: "Ireland" },
  { code: "IT", fips: "IT", iso3: "ITA", en: "Italy" },
  { code: "LV", fips: "LG", iso3: "LVA", en: "Latvia" },
  { code: "LT", fips: "LH", iso3: "LTU", en: "Lithuania" },
  { code: "MK", fips: "MK", iso3: "MKD", en: "North Macedonia" },
  { code: "NL", fips: "NL", iso3: "NLD", en: "Netherlands" },
  { code: "NO", fips: "NO", iso3: "NOR", en: "Norway" },
  { code: "PL", fips: "PL", iso3: "POL", en: "Poland" },
  { code: "PT", fips: "PO", iso3: "PRT", en: "Portugal" },
  { code: "RO", fips: "RO", iso3: "ROU", en: "Romania" },
  { code: "RS", fips: "RI", iso3: "SRB", en: "Serbia" },
  { code: "SK", fips: "LO", iso3: "SVK", en: "Slovakia" },
  { code: "SI", fips: "SI", iso3: "SVN", en: "Slovenia" },
  { code: "ES", fips: "SP", iso3: "ESP", en: "Spain" },
  { code: "SE", fips: "SW", iso3: "SWE", en: "Sweden" },
  { code: "CH", fips: "SZ", iso3: "CHE", en: "Switzerland" },
  { code: "UA", fips: "UP", iso3: "UKR", en: "Ukraine" },
  { code: "UK", fips: "UK", iso3: "GBR", en: "United Kingdom" }
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
