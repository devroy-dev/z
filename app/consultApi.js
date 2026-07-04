// consult.js — the link to Victor, thedreamai's expert consultant.
//
// callmeZ does NOT run Victor. He lives on thedreamai's engine; we call in. This is
// deliberate: one Victor, one source of truth, and every consultation is also a live
// demo of thedreamai (the flywheel — callmeZ's reach makes the David visible).
//
// The contract mirrors thedreamai's own web client exactly:
//   GET  /professions            → the domains you can consult
//   POST /consult-mint {profession_key, phone} → { agent_id, blocked, first_of_day, first_ever }
//   POST /chat {agent_id, message, conversation_id} → { reply, conversation_id, ... }
//   POST /consult-close {phone, agent_id, turn_count}
//
// Phone-keyed access (3 free/IST-day) is enforced on thedreamai's side; we just carry
// the caller's phone through. No new auth — the engine is public + phone-metered.

const DREAMAI_ENGINE = 'https://dreamai-production-c2e6.up.railway.app';

async function daFetch(path, body) {
  const r = await fetch(`${DREAMAI_ENGINE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error('consult engine error');
  return r.json();
}

// the domains Victor is prepared in
export async function consultFields() {
  try {
    const r = await fetch(`${DREAMAI_ENGINE}/professions`);
    if (!r.ok) return [];
    const d = await r.json();
    return (d.professions ?? []);
  } catch (e) { return []; }
}

// open a session on a chosen field. phone carries the callmeZ user's identity so the
// daily-free gate + demand map work the same as on thedreamai. NOTE: the engine returns
// HTTP 403 with {blocked:true} when the daily cap is hit — that's a valid outcome, not an
// error, so we read the body regardless of status and let the caller show the "come back
// tomorrow" screen instead of a generic failure.
export async function consultMint(profession_key, phone) {
  const r = await fetch(`${DREAMAI_ENGINE}/consult-mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profession_key, phone }),
  });
  const d = await r.json().catch(() => ({}));
  // blocked (403) is a real, expected outcome — surface it, don't throw.
  if (d && d.blocked) return { blocked: true, restricted: !!d.restricted, sessions_today: d.sessions_today };
  if (!r.ok) throw new Error(d?.error || 'consult engine error');
  return d;
}

// a turn with Victor
export async function consultChat(agent_id, message, conversation_id) {
  return daFetch('/chat', { agent_id, message, conversation_id });
}

// end the session (best-effort; logs duration/turns, disposes the ephemeral agent)
export async function consultClose(phone, agent_id, turn_count) {
  try { await daFetch('/consult-close', { phone, agent_id, turn_count }); } catch (e) {}
}
