/**
 * Load Pack A + Pack B from talk-track-packs-ab.csv into talk_track_cards.
 * Run from app-platform: npm run load:talk-track
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Additive and idempotent: inserts missing cards, never deletes.
 * Keeps the lobby sample (SOCK / LADDER / MUSTARD / ASTRONAUT / PHOTOSYNTHESIS)
 * marked inactive. Retires the two fixture playable cards on Pack A.
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const DEFAULT_CSV = "supabase/seed-data/talk-track-packs-ab.csv";
const LOBBY_SAMPLE = ["SOCK", "LADDER", "MUSTARD", "ASTRONAUT", "PHOTOSYNTHESIS"] as const;
const CARDS_PER_PACK = 30;

type CsvCard = {
  pack: "A" | "B";
  cardNumber: number;
  words: [string, string, string, string, string];
};

type PackMeta = {
  slug: string;
  label: string;
  subtitle: string;
  sortOrder: number;
};

const PACKS: Record<"A" | "B", PackMeta> = {
  A: {
    slug: "a",
    label: "Pack A",
    subtitle: "Thirty playable cards",
    sortOrder: 1,
  },
  B: {
    slug: "b",
    label: "Pack B",
    subtitle: "Thirty playable cards",
    sortOrder: 2,
  },
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeWord(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

function cardKey(words: readonly string[]): string {
  return words.map(normalizeWord).join("|");
}

function parseCsv(raw: string): CsvCard[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines[0];
  if (!header) {
    console.error("CSV is empty.");
    process.exit(1);
  }
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const expected = ["pack", "card_number", "word_1", "word_2", "word_3", "word_4", "word_5"];
  if (expected.some((name, i) => cols[i] !== name)) {
    console.error(`Unexpected CSV header: ${header}`);
    process.exit(1);
  }

  const cards: CsvCard[] = [];
  for (const line of lines.slice(1)) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length !== 7) {
      console.error(`Bad row (expected 7 columns): ${line}`);
      process.exit(1);
    }
    const packRaw = parts[0] ?? "";
    const pack = packRaw.toUpperCase();
    if (pack !== "A" && pack !== "B") {
      console.error(`Unknown pack "${packRaw}" in: ${line}`);
      process.exit(1);
    }
    const cardNumber = Number(parts[1]);
    if (!Number.isInteger(cardNumber) || cardNumber < 1) {
      console.error(`Bad card_number in: ${line}`);
      process.exit(1);
    }
    const words = [
      normalizeWord(parts[2] ?? ""),
      normalizeWord(parts[3] ?? ""),
      normalizeWord(parts[4] ?? ""),
      normalizeWord(parts[5] ?? ""),
      normalizeWord(parts[6] ?? ""),
    ] as [string, string, string, string, string];
    if (words.some((w) => w.length === 0 || w.includes(" "))) {
      console.error(`Each slot must be a single non-empty token: ${line}`);
      process.exit(1);
    }
    cards.push({ pack, cardNumber, words });
  }
  return cards;
}

function validateCards(cards: CsvCard[]): void {
  const lobbyKey = cardKey(LOBBY_SAMPLE);
  for (const pack of ["A", "B"] as const) {
    const packCards = cards.filter((c) => c.pack === pack);
    if (packCards.length !== CARDS_PER_PACK) {
      console.error(`Pack ${pack} has ${packCards.length} cards; expected ${CARDS_PER_PACK}.`);
      process.exit(1);
    }
    const seenNumbers = new Set<number>();
    const seenWords = new Set<string>();
    for (const card of packCards) {
      if (seenNumbers.has(card.cardNumber)) {
        console.error(`Pack ${pack} repeats card_number ${card.cardNumber}.`);
        process.exit(1);
      }
      seenNumbers.add(card.cardNumber);
      if (cardKey(card.words) === lobbyKey) {
        console.error(`Pack ${pack} card ${card.cardNumber} collides with the lobby sample.`);
        process.exit(1);
      }
      for (const word of card.words) {
        if (seenWords.has(word)) {
          console.error(`Pack ${pack} repeats word "${word}".`);
          process.exit(1);
        }
        seenWords.add(word);
      }
    }
  }
}

async function ensurePack(
  supabase: ReturnType<typeof createServiceClient>,
  protocolId: string,
  meta: PackMeta
): Promise<string> {
  const { data: existing, error: lookupErr } = await supabase
    .from("content_packs")
    .select("id")
    .eq("protocol_id", protocolId)
    .eq("slug", meta.slug)
    .maybeSingle();
  if (lookupErr) {
    console.error(`Pack ${meta.slug} lookup failed:`, lookupErr.message);
    process.exit(1);
  }
  if (existing) return existing.id as string;

  const { data: inserted, error: insertErr } = await supabase
    .from("content_packs")
    .insert({
      protocol_id: protocolId,
      slug: meta.slug,
      label: meta.label,
      subtitle: meta.subtitle,
      sort_order: meta.sortOrder,
      status: "active",
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    console.error(`Pack ${meta.slug} insert failed:`, insertErr?.message);
    process.exit(1);
  }
  console.log(`Created content pack ${meta.label}.`);
  return inserted.id as string;
}

async function ensureLobbySample(
  supabase: ReturnType<typeof createServiceClient>,
  packId: string
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("talk_track_cards")
    .select("id, word_1, word_2, word_3, word_4, word_5, active")
    .eq("content_pack_id", packId);
  if (error) {
    console.error("Could not list Pack A cards:", error.message);
    process.exit(1);
  }
  const lobbyKey = cardKey(LOBBY_SAMPLE);
  const match = (rows ?? []).find(
    (row) =>
      cardKey([row.word_1, row.word_2, row.word_3, row.word_4, row.word_5] as string[]) ===
      lobbyKey
  );
  if (match) {
    if (match.active) {
      const { error: upErr } = await supabase
        .from("talk_track_cards")
        .update({ active: false })
        .eq("id", match.id);
      if (upErr) {
        console.error("Could not mark lobby sample inactive:", upErr.message);
        process.exit(1);
      }
      console.log("Marked lobby sample inactive.");
    }
    return;
  }
  const { error: insertErr } = await supabase.from("talk_track_cards").insert({
    content_pack_id: packId,
    word_1: LOBBY_SAMPLE[0],
    word_2: LOBBY_SAMPLE[1],
    word_3: LOBBY_SAMPLE[2],
    word_4: LOBBY_SAMPLE[3],
    word_5: LOBBY_SAMPLE[4],
    active: false,
  });
  if (insertErr) {
    console.error("Could not insert lobby sample:", insertErr.message);
    process.exit(1);
  }
  console.log("Inserted lobby sample (inactive).");
}

async function syncPackCards(
  supabase: ReturnType<typeof createServiceClient>,
  packId: string,
  pack: "A" | "B",
  cards: CsvCard[]
): Promise<void> {
  const { data: existing, error } = await supabase
    .from("talk_track_cards")
    .select("id, word_1, word_2, word_3, word_4, word_5, active")
    .eq("content_pack_id", packId);
  if (error) {
    console.error(`Could not list Pack ${pack} cards:`, error.message);
    process.exit(1);
  }

  const byKey = new Map<string, { id: string; active: boolean }>();
  for (const row of existing ?? []) {
    byKey.set(
      cardKey([row.word_1, row.word_2, row.word_3, row.word_4, row.word_5] as string[]),
      { id: row.id as string, active: Boolean(row.active) }
    );
  }

  const csvKeys = new Set(cards.map((c) => cardKey(c.words)));
  const lobbyKey = cardKey(LOBBY_SAMPLE);
  let inserted = 0;
  let skipped = 0;
  let activated = 0;

  for (const card of cards) {
    const key = cardKey(card.words);
    const found = byKey.get(key);
    if (!found) {
      const { error: insertErr } = await supabase.from("talk_track_cards").insert({
        content_pack_id: packId,
        word_1: card.words[0],
        word_2: card.words[1],
        word_3: card.words[2],
        word_4: card.words[3],
        word_5: card.words[4],
        active: true,
      });
      if (insertErr) {
        console.error(`Insert failed for Pack ${pack} #${card.cardNumber}:`, insertErr.message);
        process.exit(1);
      }
      inserted += 1;
      continue;
    }
    skipped += 1;
    if (!found.active) {
      const { error: upErr } = await supabase
        .from("talk_track_cards")
        .update({ active: true })
        .eq("id", found.id);
      if (upErr) {
        console.error(`Could not activate Pack ${pack} #${card.cardNumber}:`, upErr.message);
        process.exit(1);
      }
      activated += 1;
    }
  }

  let retired = 0;
  if (pack === "A") {
    for (const [key, row] of byKey) {
      if (csvKeys.has(key) || key === lobbyKey) continue;
      if (!row.active) continue;
      const { error: upErr } = await supabase
        .from("talk_track_cards")
        .update({ active: false })
        .eq("id", row.id);
      if (upErr) {
        console.error("Could not retire fixture card:", upErr.message);
        process.exit(1);
      }
      retired += 1;
    }
  }

  console.log(
    `Pack ${pack}: inserted ${inserted}, already present ${skipped}, activated ${activated}, retired ${retired}.`
  );
}

async function main(): Promise<void> {
  const csvPath = resolve(process.cwd(), process.argv[2] ?? DEFAULT_CSV);
  const cards = parseCsv(readFileSync(csvPath, "utf8"));
  validateCards(cards);
  console.log(`Validated ${cards.length} cards from ${csvPath}.`);

  const supabase = createServiceClient();

  const { data: protocol, error: protoErr } = await supabase
    .from("protocols")
    .select("id")
    .eq("slug", "talk-track")
    .maybeSingle();
  if (protoErr) {
    console.error("Could not load talk-track protocol:", protoErr.message);
    process.exit(1);
  }
  if (!protocol) {
    console.error("talk-track protocol row is missing. Apply migration 019 / run seed first.");
    process.exit(1);
  }

  const packAId = await ensurePack(supabase, protocol.id as string, PACKS.A);
  const packBId = await ensurePack(supabase, protocol.id as string, PACKS.B);

  await ensureLobbySample(supabase, packAId);
  await syncPackCards(
    supabase,
    packAId,
    "A",
    cards.filter((c) => c.pack === "A")
  );
  await syncPackCards(
    supabase,
    packBId,
    "B",
    cards.filter((c) => c.pack === "B")
  );

  console.log("Done. New Talk Track sessions default to Pack A until a pack picker exists.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
