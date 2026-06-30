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

// transcribe an audio buffer via Sarvam — returns text only (no storage).
// shared by the journal (which then stores) and chat voice notes (which don't store).
export async function transcribeAudio(audio: Buffer, mime: string): Promise<{ transcript: string; lang: string | null }> {
  if (!SARVAM_KEY) throw new Error('SARVAM_API_KEY not set');

  // Sarvam REST expects multipart/form-data: file + model + mode + language_code.
  // Sarvam validates the MIME exactly and rejects 'audio/webm;codecs=opus' even though
  // 'audio/webm' is allowed — strip the ';codecs=...' suffix to the bare type.
  const cleanMime = (mime || 'audio/webm').split(';')[0].trim();
  const ext = cleanMime.includes('webm') ? 'webm' : cleanMime.includes('mp4') ? 'mp4' : cleanMime.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  const blob = new Blob([new Uint8Array(audio)], { type: cleanMime });
  form.append('file', blob, `audio.${ext}`);
  form.append('model', 'saaras:v3');
  form.append('mode', 'codemix');
  form.append('language_code', 'unknown'); // auto-detect

  const r = await fetch(SARVAM_URL, {
    method: 'POST',
    headers: { 'api-subscription-key': SARVAM_KEY },
    body: form,
  });
  const raw = await r.text();
  if (!r.ok) {
    console.error('[transcribe] sarvam', r.status, raw.slice(0, 500));
    throw new Error(`sarvam ${r.status}: ${raw.slice(0, 300)}`);
  }
  let data: any = {};
  try { data = JSON.parse(raw); } catch { console.error('[transcribe] non-json sarvam reply:', raw.slice(0,300)); }
  // Sarvam STT response field can be transcript / text / output; cover them.
  const transcript: string = (data.transcript || data.text || data.output || data.transcript_text || '').trim();
  const lang: string | null = data.language_code || data.lang || data.detected_language || null;
  if (!transcript) throw new Error('empty transcript — sarvam keys: ' + Object.keys(data).join(','));
  return { transcript, lang };
}

// store a TYPED journal entry directly — no transcription, just the text.
export async function storeJournalText(userId: string, text: string): Promise<JournalResult> {
  const transcript = (text || '').trim();
  if (!transcript) throw new Error('empty entry');
  const { data: row, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, transcript: transcript.slice(0, 6000), lang: null })
    .select('id, transcript, lang')
    .single();
  if (error) throw new Error('journal insert: ' + error.message);
  return { id: row.id, transcript: row.transcript, lang: row.lang };
}

// transcribe an audio buffer via Sarvam, store transcript, discard audio.
export async function transcribeAndStore(
  userId: string,
  audio: Buffer,
  filename: string,
  mime: string,
): Promise<JournalResult> {
  const { transcript, lang } = await transcribeAudio(audio, mime);

  // store TEXT only — audio buffer is never persisted, goes out of scope here.
  const { data: row, error } = await supabase
    .from('journal_entries')
    .insert({ user_id: userId, transcript, lang })
    .select('id, transcript, lang')
    .single();
  if (error) throw new Error('journal insert: ' + error.message);

  return { id: row.id, transcript: row.transcript, lang: row.lang };
}
