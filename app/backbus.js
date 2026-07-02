// ════════════════════════════════════════════════════════════════════════
//  yourZ — the back bus. Android's back gesture should walk INWARD layers
//  (chat → roster, scene → library, panel → desk) before it ever exits the
//  app. Any component that represents a "layer" registers a handler while
//  active; the newest active layer gets the gesture. No handler claims it →
//  Nav falls back (non-desk tab → desk; bare desk → let the system exit).
// ════════════════════════════════════════════════════════════════════════
import { useEffect } from 'react';

const stack = [];

export function pushBack(handler) {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

// register `handler` as the top back layer while `active` is true
export function useBackLayer(active, handler) {
  useEffect(() => {
    if (!active) return undefined;
    return pushBack(handler);
  }, [active, handler]);
}

// called by the ONE global BackHandler listener (in Nav)
export function handleBack() {
  for (let i = stack.length - 1; i >= 0; i--) {
    try { if (stack[i]() === true) return true; } catch (_) {}
  }
  return false;
}
