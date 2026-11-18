#!/usr/bin/env node
/* Cheil CoE Hub daily news job.
   node run.mjs                     fetch sources, ask Claude, write out/news-feed.json (needs ANTHROPIC_API_KEY)
   node run.mjs --dry-run           fetch sources and write out/candidates.json only (no key, no cost)
   node run.mjs --candidates F      use saved candidates instead of fetching
   node run.mjs --mock              skip Claude: one headline per market, for testing the app
   node run.mjs --out DIR           output folder (default ./out)
   Env: ANTHROPIC_API_KEY, NEWS_PREVIOUS_URL (yesterday's published feed, optional), NEWS_EFFORT (default medium), NEWS_MODEL. */
import fs from "node:fs/promises";
import path from "node:path";
import { CODES, EXTRA_FEEDS } from "./markets.mjs";
import { gdacs, gdelt, rss, tidy } from "./sources.mjs";
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

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  let candidates;
  const file = value("--candidates");
  if (file) {
    candidates = tidy(JSON.parse(await fs.readFile(file, "utf8")), { maxAgeHours: 24 * 365 });
    log(`Loaded ${candidates.length} candidates from ${file}`);
  } else {
    const [a, b, c, d] = [await gdacs(log), await rss(log, EXTRA_FEEDS), await previousItems(), await gdelt(log)];
    candidates = tidy([...a, ...b, ...c, ...d]);
    log(`${candidates.length} candidates after removing duplicates`);
  }
  await fs.writeFile(path.join(outDir, "candidates.json"), JSON.stringify(candidates, null, 1));
  if (flag("--dry-run")) return log(`Dry run: wrote ${path.join(outDir, "candidates.json")}`);
  if (!candidates.length) throw new Error("No candidates: every source failed. Keeping the previous feed.");

  const mock = flag("--mock");
  if (!mock && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Use --dry-run or --mock to test without it.");
  const picks = mock ? selectMock(candidates) : await selectWithClaude(candidates, { log });
  const items = toFeedItems(picks, candidates);

  const feed = { version: 1, generatedAt: new Date().toISOString(), model: mock ? "mock" : MODEL, markets: CODES, items };
  const tmp = feedPath + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(feed, null, 1));
  await fs.rename(tmp, feedPath); // never leave a half-written feed
  log(`Wrote ${items.length} items for ${new Set(items.map((i) => i.market)).size} markets to ${feedPath}`);
}

main().catch((e) => {
  log(`Failed: ${e.message}`);
  process.exit(1);
});
