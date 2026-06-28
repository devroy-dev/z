// journal.ts — the audio journal. "Just record." Audio in → Sarvam transcribes → we keep
// the TEXT only (audio discarded) → stored as a journal entry the overseer reads.
//
// Sarvam REST /speech-to-text, model saaras:v3, mode 'codemix' (English words in English,
// Indic words in native script — how India actually talks). REST handles clips up to ~30s
// synchronously; for the journal's short bursts that's the right, simplest fit.
//
// The transcript is overseer material under the SAME §4/§5 codex rules as chat. No separate
// unguarded path: voice is rawer than typed text, so the same care must cover it.
import { supabase } from './db.js';

const SARVAM_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_URL = 'https://api.sarvam.ai/speech-to-text';

export interface JournalResult { id: string; transcript: string; lang: string | null; }

// transcribe an audio buffer via Sarvam, store transcript, discard audio.
export async function transcribeAndStore(
  userId: string,
  audio: Buffer,
  filename: string,
  mime: string,
): Promise<JournalResult> {
  if (!SARVAM_KEY) throw new Error('SARVAM_API_KEY not set');

  // Sarvam REST expects multipart/form-data: file + model + mode + language_code
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audio)], { type: mime || 'audio/wav' });
  form.append('file', blob, filename || 'journal.wav');
  form.append('model', 'saaras:v3');
  form.append('mode', 'codemix');
  form.append('language_code', 'unknown'); // auto-detect

  const r = await fetch(SARVAM_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_KEY },
    body: form,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    throw new Error(`sarvam ${r.status}: ${detail.slice(0, 300)}`);
  }
  const data: any = await r.json();
  const transcript: string = (data.transcript || data.text || '').trim();
  const lang: string | null = data.language_code || data.lang || null;
  if (!transcript) throw new Error('empty transcript');

  // store TEXT only — audio buffer is never persisted, goes out of scope here.
  const { data: row, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, transcript, lang })
    .select('id, transcript, lang')
    .single();
  if (error) throw new Error('journal insert: ' + error.message);

  return { id: row.id, transcript: row.transcript, lang: row.lang };
}
