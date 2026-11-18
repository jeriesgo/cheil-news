/* Claude reads the candidate headlines and keeps only what a Cheil team member must keep in mind with clients.
   It returns candidate ids plus ES/EN wording; url, source and date always come from the candidate, never from the model. */
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { MARKETS, CODES, CATEGORIES } from "./markets.mjs";

export const MODEL = process.env.NEWS_MODEL || "claude-opus-5-5";

const SYSTEM = `You curate a tiny daily briefing for Cheil, the marketing agency that runs Samsung campaigns across Europe.
Each team member looks after a few countries. On their home screen they see at most two events per country: only what they must keep in mind when talking to clients or scheduling campaigns.

Keep an event only if it is major, national in scale, and recent or still unfolding:
- election: national or major regional elections, referendums, government collapse or snap elections called.
- disaster: wildfires, floods, earthquakes or accidents with deaths, evacuations or a state of emergency.
- strike: national or sector-wide strikes that disrupt transport, logistics, retail or public services.
- weather: official orange or red weather warnings over large areas.
- mourning: official national mourning, death of a head of state or a national figure.
- economy: decisions that change consumer spending or electronics retail (VAT changes, energy subsidies, bank holidays added, retail closures).
- health: public health emergencies with restrictions.

Leave out: crime, court cases, celebrity, sport, opinion, routine politics and polls, company news, foreign events that only mention the country, and anything you cannot tell is major from the headline. Returning nothing for a country is the normal case.

When several headlines describe the same event, pick one candidate for it (prefer the most authoritative source). Candidates marked "shown yesterday" may stay only while the event is still unfolding.

Write for the team, in a calm and factual tone, sentence case, no exclamation marks, no emoji, no invented details beyond the headlines:
- title: what happened, at most 90 characters. Spanish from Spain and British English.
- note: one practical line on what it means for clients or campaigns, at most 120 characters (for example: review upbeat content for the region, expect delivery delays, election period so avoid political tones).
Use the country code of the country the event happens in.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidate_id: { type: "string" },
          market: { type: "string", enum: CODES },
          category: { type: "string", enum: CATEGORIES },
          title_es: { type: "string" },
          title_en: { type: "string" },
          note_es: { type: "string" },
          note_en: { type: "string" }
        },
        required: ["candidate_id", "market", "category", "title_es", "title_en", "note_es", "note_en"],
        additionalProperties: false
      }
    }
  },
  required: ["items"],
  additionalProperties: false
};

function line(c) {
  const day = c.publishedAt.slice(0, 10);
  const prev = c.origin === "previous" ? " [shown yesterday]" : "";
  const extra = c.extra ? ` (${c.extra.slice(0, 160)})` : "";
  return `${c.id} | ${day} | ${c.source} | ${c.title}${extra}${prev}`;
}

export function prompt(candidates) {
  const parts = [`Today is ${new Date().toISOString().slice(0, 10)}. Candidate headlines, grouped by country:`];
  for (const m of MARKETS) {
    const list = candidates.filter((c) => c.market === m.code);
    if (list.length) parts.push(`\n## ${m.code} (${m.en})\n${list.map(line).join("\n")}`);
  }
  const loose = candidates.filter((c) => !c.market);
  if (loose.length) parts.push(`\n## Pan-European feeds (set the market yourself, skip if not about one of our countries)\n${loose.map(line).join("\n")}`);
  parts.push(`\nOur countries: ${CODES.join(", ")}. Return the items worth showing, at most two per country.`);
  return parts.join("\n");
}

/* Turns the model's picks into feed items, dropping anything that does not match a real candidate. */
export function toFeedItems(picks, candidates, maxPerMarket = 2) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const per = {};
  const used = new Set();
  const out = [];
  for (const p of picks) {
    const c = byId.get(p.candidate_id);
    if (!c || used.has(c.id)) continue;
    if (c.market && c.market !== p.market) continue;
    if (!CODES.includes(p.market) || !CATEGORIES.includes(p.category)) continue;
    per[p.market] = (per[p.market] || 0) + 1;
    if (per[p.market] > maxPerMarket) continue;
    used.add(c.id);
    out.push({
      id: c.origin === "previous" && c.prevId ? c.prevId : `${p.market}-${createHash("sha1").update(c.url).digest("hex").slice(0, 12)}`,
      market: p.market,
      category: p.category,
      title: { es: p.title_es.trim(), en: p.title_en.trim() },
      note: { es: p.note_es.trim(), en: p.note_en.trim() },
      source: c.source,
      url: c.url,
      publishedAt: c.publishedAt,
      sample: false
    });
  }
  return out;
}

export async function selectWithClaude(candidates, { effort = process.env.NEWS_EFFORT || "medium", log = console.error } = {}) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // if the model declines, the API retries on Anthropic's recommended fallback model
    thinking: { type: "adaptive" },
    output_config: { effort, format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt(candidates) }]
  });
  const msg = await stream.finalMessage();
  log(`Claude: ${msg.model}, stop ${msg.stop_reason}, ${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out tokens`);
  if (msg.stop_reason === "refusal") throw new Error(`Claude declined: ${msg.stop_details?.category || "no category"}`);
  if (msg.stop_reason === "max_tokens") throw new Error("Claude ran out of tokens before finishing");
  const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text).items || [];
}

/* No key, no cost: keeps the newest candidate per market and copies the headline. For testing the pipeline and the app only. */
export function selectMock(candidates) {
  const seen = new Set();
  return [...candidates]
    .filter((c) => c.market)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .filter((c) => (seen.has(c.market) ? false : seen.add(c.market)))
    .map((c) => ({ candidate_id: c.id, market: c.market, category: c.category || "disaster",
      title_es: c.title, title_en: c.title, note_es: "Prueba sin IA: revisa la noticia original.", note_en: "Test without AI: check the original story." }));
}
