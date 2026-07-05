// coachEmbed.ts — THE EMBEDDING DOOR for the coach's material shelf.
// Ported from the dreamai engine (reference only), native to yourZ. One place every
// vector flows through, provider swappable by env (never hardcoded downstream).
//   embed(texts, kind)          — texts → 1024-dim vectors via the configured provider.
//   embedQueryLiteral(query)    — one query → one pgvector literal (or null; never throws).
//   embedBriefOnShelve(briefId) — fill the meaning index for a freshly-shelved Brief.
// Voyage embeddings are unit-normalised; cosine == dot, matching the fused RPC's `<=>`.
// Swap providers later = add a branch here + set EMBED_PROVIDER / EMBED_MODEL.
import { supabase } from './db.js';

const PROVIDER = process.env.EMBED_PROVIDER ?? 'voyage';
const MODEL = process.env.EMBED_MODEL ?? 'voyage-4';
const DIM = 1024;
const SLEEP_MS = Number(process.env.EMBED_SLEEP_MS ?? '0');
const BATCH = Number(process.env.EMBED_BATCH ?? '96');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Format a vector for a pgvector column/arg: the canonical '[a,b,c]' text form. */
export function toVectorLiteral(v: number[]): string {
  return '[' + v.join(',') + ']';
}

async function voyageBatch(inputs: string[], kind: 'query' | 'document', tries = 5): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY not set');
  for (let attempt = 1; attempt <= tries; attempt++) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, input: inputs, input_type: kind, output_dimension: DIM }),
    });
    if (res.status === 429 && attempt < tries) { await sleep(20000); continue; }
    if (!res.ok) throw new Error(`Voyage ${MODEL} ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.slice().sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
  throw new Error('Voyage: exhausted retries');
}

/** texts → vectors, batched and throttle-aware. Provider chosen by env. */
export async function embed(texts: string[], kind: 'query' | 'document'): Promise<number[][]> {
  if (!texts.length) return [];
  if (PROVIDER !== 'voyage') throw new Error(`EMBED_PROVIDER '${PROVIDER}' not wired`);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    if (i > 0 && SLEEP_MS) await sleep(SLEEP_MS);
    out.push(...(await voyageBatch(texts.slice(i, i + BATCH), kind)));
  }
  return out;
}

/** One query → one vector literal (or null if it can't be embedded). Never throws:
 *  a provider hiccup degrades retrieval cleanly to FTS-only. */
export async function embedQueryLiteral(query: string): Promise<string | null> {
  try {
    const [v] = await embed([query], 'query');
    return v ? toVectorLiteral(v) : null;
  } catch {
    return null;
  }
}

/** Fill embeddings for a freshly-shelved Brief's §-rows. NON-FATAL by contract —
 *  a hiccup never blocks shelving (FTS is already live via the generated tsv). */
export async function embedBriefOnShelve(briefId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('coach_brief_sections').select('id, body').eq('brief_id', briefId).is('embedding', null);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; body: string }[];
    if (!rows.length) return;
    const vecs = await embed(rows.map((r) => r.body), 'document');
    for (let i = 0; i < rows.length; i++) {
      if (!vecs[i]) continue;
      await supabase.from('coach_brief_sections').update({ embedding: toVectorLiteral(vecs[i]) }).eq('id', rows[i].id);
    }
  } catch (e) {
    console.error('[coach-embed] on-shelve embedding deferred:', e instanceof Error ? e.message : String(e));
  }
}
