#!/usr/bin/env node
/* Cheil CoE Hub daily news job.
   node run.mjs                     with ANTHROPIC_API_KEY: AI mode (alerts + press, chosen by Claude).
                                    without it: free mode (official GDACS and MeteoAlarm alerts only, fixed wording).
                                    plus, in free mode, up to one press headline per country picked by keywords (Google News).
   node run.mjs --free              force the free mode even with a key
   node run.mjs --no-press          free mode without press headlines (official alerts only)
   node run.mjs --dry-run           fetch sources and write out/candidates.json only (no key, no cost)
   node run.mjs --candidates F      use saved candidates instead of fetching
   node run.mjs --mock              skip Claude: one headline per market, for testing the app
   node run.mjs --out DIR           output folder (default ./out)
   Env: ANTHROPIC_API_KEY, NEWS_PREVIOUS_URL (yesterday's published feed, optional), NEWS_EFFORT (default medium), NEWS_MODEL. */
import fs from "node:fs/promises";
import path from "node:path";
import { CODES, MARKETS, EXTRA_FEEDS } from "./markets.mjs";
import { gdacs, rss, meteoalarm, tidy, stats, get, items, tag, iso, sleep } from "./sources.mjs";
import { gnews } from "./gnews.mjs";
import { selectFree } from "./free.mjs";
import { selectPress } from "./press.mjs";
import { MODEL, selectWithClaude, selectMock, toFeedItems } from "./select.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const value = (n, d) => (args.indexOf(n) > -1 ? args[args.indexOf(n) + 1] : d);
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

const outDir = value("--out", "out");
const feedPath = path.join(outDir, "news-feed.json");

async function previousItems() {
  try {
    const url = process.env.NEWS_PREVIOUS_URL;
    const raw = url ? await (await fetch(url)).text() : await fs.readFile(feedPath, "utf8");
    const feed = JSON.parse(raw);
    return (feed.items || []).map((n) => ({ market: n.market, source: n.source, title: n.title.en, url: n.url,
      publishedAt: n.publishedAt, origin: "previous", category: n.category, prevId: n.id }));
  } catch {
    return [];
  }
}

/* Free mode: official alerts, plus one press headline per country when there is one; at most 2 per country, the top alert first. */
function freeItems(candidates) {
  const alerts = selectFree(candidates, MARKETS);
  const press = flag("--no-press") ? [] : selectPress(candidates);
  const out = [];
  for (const code of CODES) {
    const a = alerts.filter((i) => i.market === code), p = press.filter((i) => i.market === code);
    out.push(...(p.length ? [...a.slice(0, 1), ...p] : a.slice(0, 2)));
  }
  return out;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const mock = flag("--mock");
  const ai = !mock && !flag("--free") && !!process.env.ANTHROPIC_API_KEY;
  log(mock ? "Mode: mock (test)" : ai ? "Mode: AI" : "Mode: free (no ANTHROPIC_API_KEY): official alerts only");

  let candidates;
  const file = value("--candidates");
  if (file) {
    candidates = tidy(JSON.parse(await fs.readFile(file, "utf8")), { maxAgeHours: 24 * 365 });
    log(`Loaded ${candidates.length} candidates from ${file}`);
  } else {
    const alerts = [...(await gdacs(log)), ...(await meteoalarm(log))];
    const press = ai || flag("--dry-run") || !flag("--no-press") ? [...(await rss(log, EXTRA_FEEDS)), ...(await previousItems()), ...(await gnews(log, { get, items, tag, iso, sleep }))] : [];
    candidates = tidy([...alerts, ...press]);
    log(`${candidates.length} candidates after removing duplicates (${stats.ok} sources answered, ${stats.failed} failed)`);
    if (!stats.ok) throw new Error("No source could be reached. Keeping the previous feed.");
  }
  await fs.writeFile(path.join(outDir, "candidates.json"), JSON.stringify(candidates, null, 1));
  if (flag("--dry-run")) return log(`Dry run: wrote ${path.join(outDir, "candidates.json")}`);

  let items, model;
  if (mock) {
    items = toFeedItems(selectMock(candidates), candidates); model = "mock";
  } else if (ai) {
    if (!candidates.length) throw new Error("No candidates: every source failed. Keeping the previous feed.");
    try {
      items = toFeedItems(await selectWithClaude(candidates, { log }), candidates); model = MODEL;
    } catch (e) {
      log(`AI step failed (${e.message}). Falling back to the free mode for today.`);
      items = freeItems(candidates); model = "free";
    }
  } else {
    items = freeItems(candidates); model = "free";
  }

  const feed = { version: 1, generatedAt: new Date().toISOString(), mode: model === "free" ? "free" : model === "mock" ? "mock" : "ai", model, markets: CODES, items };
  const tmp = feedPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(feed, null, 1));
  await fs.rename(tmp, feedPath); // never leave a half-written feed
  log(`Wrote ${items.length} items for ${new Set(items.map((i) => i.market)).size} markets to ${feedPath}`);
}

main().catch((e) => {
  log(`Failed: ${e.message}`);
  process.exit(1);
});
