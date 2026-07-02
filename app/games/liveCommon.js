// ════════════════════════════════════════════════════════════════════════
//  yourZ — shared scaffolding for LIVE (multiplayer) tables: the polling
//  session driver, seat labels, and the standard live-table chrome.
// ════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react';
import { getGameSession, sendGameMove, claimGameSeat } from '../api';
import { personaMeta } from './personas';

export function useLiveSession(sessionId) {
  const [view, setView] = useState(null);
  const versionRef = useRef(0);
  useEffect(() => {
    let on = true;
    const refresh = async () => {
      try {
        const v = await getGameSession(sessionId);
        if (on && v && v.version !== versionRef.current) { versionRef.current = v.version; setView(v); }
      } catch (e) {
        // not seated yet → claim an open chair, then look again
        if (String(e?.message || '').includes('not seated')) {
          const c2 = await claimGameSeat(sessionId);
          if (c2?.ok) {
            try { const v2 = await getGameSession(sessionId); if (on && v2) { versionRef.current = v2.version; setView(v2); } } catch (e2) {}
          }
        }
      }
    };
    refresh();
    const t = setInterval(refresh, 1500);
    return () => { on = false; clearInterval(t); };
  }, [sessionId]);
  const move = useCallback(async (m) => {
    try { await sendGameMove(sessionId, m, versionRef.current); } catch (e) {}
    try {
      const v = await getGameSession(sessionId);
      if (v) { versionRef.current = v.version; setView(v); }
    } catch (e) {}
  }, [sessionId]);
  return { view, move };
}

export function seatLabelFn(view, names = {}) {
  return (i) => {
    const s = view?.seats?.[i];
    if (!s) return '?';
    if (s.kind === 'persona') return (personaMeta(s.id)?.name || s.id).replace(/^the /, '');
    if (i === view.mySeat) return 'you';
    return names[s.id] || 'friend';
  };
}
export const seatFace = (view, i) => {
  const s = view?.seats?.[i];
  return s?.kind === 'persona' ? s.id : null;
};
