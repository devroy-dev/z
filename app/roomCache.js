// roomCache.js — [DESK ALIVE, HOUSE-WIDE] every room opens already knowing.
// The DeskPane v3 pattern, generalized: a module-level memory cache preloaded
// at bundle boot (the disk read races the app's own startup and wins), written
// through on every fresh load. Rooms paint their last known state on the FIRST
// frame (hydrate via useLayoutEffect — before paint); the network refreshes
// silently behind. The only quiet first-open left is a fresh install's — and
// that one is truth, not lag.
import AsyncStorage from '@react-native-async-storage/async-storage';

const mem = Object.create(null);
const KEYS = ['mm', 'stylist', 'travel', 'bulletin'];

// import-time preload — fires when the bundle evaluates, long before any room mounts
for (const k of KEYS) {
  AsyncStorage.getItem('z_room_cache_' + k)
    .then((c) => { if (c && mem[k] === undefined) { try { mem[k] = JSON.parse(c); } catch (e) {} } })
    .catch(() => {});
}

export function roomCache(key) { return mem[key] || null; }

export function saveRoomCache(key, bundle) {
  try {
    // never poison the cache with error sentinels or empty shells
    for (const v of Object.values(bundle)) if (v === '__err') return;
    mem[key] = bundle;
    AsyncStorage.setItem('z_room_cache_' + key, JSON.stringify(bundle)).catch(() => {});
  } catch (e) {}
}
