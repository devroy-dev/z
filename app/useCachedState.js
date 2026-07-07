// ════════════════════════════════════════════════════════════════════════
//  yourZ — useCachedState · THE LOCAL-FIRST LAW (R0)
//  Extracted from the pattern hand-rolled three times on 2026-07-07 (chat
//  instant-paint, boot-gate, profile identity cache — all device-proven):
//    1. seed from an AsyncStorage snapshot on mount — paint NOW;
//    2. expose `booted` so empty-states never render before the cache answers;
//    3. refresh from the network when a fetcher is given;
//    4. write the snapshot back, debounced.
//  LAW: no screen ships a raw fetch-then-render for identity or history.
//  It rides this hook.
// ════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function useCachedState(key, fetcher, opts = {}) {
  const { debounceMs = 600, transform = null } = opts;
  const [value, setValueRaw] = useState(null);
  const [booted, setBooted] = useState(false);
  const aliveRef = useRef(true);
  const timerRef = useRef(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  // 1+2 · seed from the snapshot; booted flips whether or not a snapshot exists.
  useEffect(() => {
    aliveRef.current = true;
    setBooted(false);
    AsyncStorage.getItem(key).then((c) => {
      if (!aliveRef.current) return;
      try {
        if (c != null) {
          const parsed = JSON.parse(c);
          setValueRaw((cur) => (cur == null ? parsed : cur));
        }
      } catch (e) {}
      setBooted(true);
    }).catch(() => { if (aliveRef.current) setBooted(true); });
    return () => { aliveRef.current = false; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [key]);

  // 4 · debounced writeback on every set.
  const persist = useCallback((v) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const snap = transform ? transform(v) : v;
      if (snap == null) return;
      AsyncStorage.setItem(keyRef.current, JSON.stringify(snap)).catch(() => {});
    }, debounceMs);
  }, [transform, debounceMs]);

  const setValue = useCallback((next) => {
    setValueRaw((cur) => {
      const v = typeof next === 'function' ? next(cur) : next;
      persist(v);
      return v;
    });
  }, [persist]);

  // 3 · network refresh (manual or on-mount if a fetcher is provided).
  const refresh = useCallback(async () => {
    if (!fetcher) return;
    try {
      const fresh = await fetcher();
      if (aliveRef.current && fresh !== undefined) setValue(fresh);
    } catch (e) {}
  }, [fetcher, setValue]);

  useEffect(() => { if (fetcher) refresh(); }, [key]);   // eslint-disable-line

  return { value, setValue, booted, refresh };
}
