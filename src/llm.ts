// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE SECOND GENERATOR (minimal wiring; full spec: yourZ-second-generator.md)
//  One facade in front of every model call in the house. All 21 engine files
//  construct their client through llm() instead of `new Anthropic(...)`; the
//  facade routes to the provider named by LLM_PROVIDER and translates what
//  must be translated. Born in the credits outage of 2026-07: the lights-on
//  guarantee starts here.
//
//  PROVIDERS (all speak the Anthropic Messages API — that's the whole trick):
//    anthropic  — the house voice (default)
//    glm        — z.ai,      https://api.z.ai/api/anthropic       (ZAI_API_KEY)
//    deepseek   — DeepSeek,  https://api.deepseek.com/anthropic   (DEEPSEEK_API_KEY)
//
//  ENV:
//    LLM_PROVIDER        anthropic | glm | deepseek   (the force switch)
//    LLM_GLM_MODEL       default glm-4.7-flash        (free tier)
//    LLM_DEEPSEEK_MODEL  default deepseek-v4-flash    (explicit — legacy aliases die 2026-07-24)
//    DEEPSEEK_WEB=1      let web_search tools through to DeepSeek (their compat
//                        matrix documents server_tool_use support — curl-verify first)
//
//  TRANSLATIONS on non-anthropic providers:
//    · model → the provider's model (single model per provider in forced mode;
//      note: sonnet-class work — the distill clerk — degrades to that model too.
//      Tier-aware mapping arrives with the full build.)
//    · web_search tools stripped unless the provider capability allows
//    · cache_control stripped everywhere (provider cache semantics unverified)
//  KNOWN LEDGER LIE in forced mode: usage_log records the claude model name at
//  claude rates. Bounded, accepted for the test window; the vendor column in
//  the full build ends it.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';

type ProviderKey = 'anthropic' | 'glm' | 'deepseek';

const CONF: Record<ProviderKey, {
  baseURL?: string;
  keyEnv: string;
  model: (requested: string) => string;
  webSearch: () => boolean;
  cache: boolean;
  noThink?: boolean;   // [zip38] provider mutters (emits thinking blocks) unless told not to
}> = {
  anthropic: {
    keyEnv: 'ANTHROPIC_API_KEY',
    model: (m) => m,
    webSearch: () => true,
    cache: true,
  },
  glm: {
    baseURL: 'https://api.z.ai/api/anthropic',
    keyEnv: 'ZAI_API_KEY',
    model: () => process.env.LLM_GLM_MODEL || 'glm-4.7-flash',
    webSearch: () => glmWeb(),   // [zip43] probe-decided, not assumed — the blind notice covers whenever off or unsupported
    cache: false,
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/anthropic',
    keyEnv: 'DEEPSEEK_API_KEY',
    model: () => process.env.LLM_DEEPSEEK_MODEL || 'deepseek-v4-flash',
    webSearch: () => deepseekWeb(),
    cache: false,
    noThink: true,   // probe-proven: silent reasoning ate a 220-token note whole
  },
};

let _webOverride: boolean | null = null;   // [zip40] the console's search switch
export function setLlmWeb(v: boolean | null): void { _webOverride = typeof v === 'boolean' ? v : null; }
function deepseekWeb(): boolean { return _webOverride ?? (process.env.DEEPSEEK_WEB === '1'); }
function glmWeb(): boolean { return _webOverride ?? (process.env.GLM_WEB === '1'); }   // [zip43] symmetric switch; the console override governs the ACTIVE provider
let _override: ProviderKey | null = null;   // [zip37] the console's fast lever — resets on restart, env stays durable
export function setLlmOverride(p: string | null): ProviderKey {
  _override = p && CONF[p as ProviderKey] ? (p as ProviderKey) : null;
  return llmProvider();
}
export function llmStatus() {
  const env = String(process.env.LLM_PROVIDER || 'anthropic');
  return {
    active: llmProvider(),
    override: _override,
    env: CONF[env as ProviderKey] ? env : 'anthropic',
    keys: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      glm: !!process.env.ZAI_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
    },
    web: {
      active: llmProvider() === 'glm' ? glmWeb() : llmProvider() === 'deepseek' ? deepseekWeb() : true,
      override: _webOverride,
      env: llmProvider() === 'glm' ? (process.env.GLM_WEB === '1') : (process.env.DEEPSEEK_WEB === '1'),
    },   // [zip43] the active provider's truth
  };
}
export function llmProvider(): ProviderKey {
  if (_override) return _override;
  const p = String(process.env.LLM_PROVIDER || 'anthropic') as ProviderKey;
  return CONF[p] ? p : 'anthropic';
}

const clients: Partial<Record<ProviderKey, Anthropic>> = {};
function clientFor(p: ProviderKey): Anthropic {
  if (!clients[p]) {
    const c = CONF[p];
    clients[p] = new Anthropic({
      fetch: globalThis.fetch as any,
      ...(c.baseURL ? { baseURL: c.baseURL } : {}),
      ...(process.env[c.keyEnv] ? { apiKey: process.env[c.keyEnv] } : {}),
    });
  }
  return clients[p]!;
}

// strip every cache_control key, deep — provider cache semantics are unverified,
// and an Anthropic-only field rejected by a strict endpoint kills the call.
function stripCache(v: any): any {
  if (Array.isArray(v)) return v.map(stripCache);
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === 'cache_control') continue;
      out[k] = stripCache(val);
    }
    return out;
  }
  return v;
}

function translate(params: any): any { return translateFor(llmProvider(), params); }   // [zip54g] provider now explicit
function translateFor(p: ProviderKey, params: any): any {
  if (p === 'anthropic') return params;
  const c = CONF[p];
  let out = { ...params, model: c.model(String(params?.model || '')) };
  if (c.noThink && out.thinking === undefined) out.thinking = { type: 'disabled' };   // no muttering — callers may still opt in explicitly
  if (!c.cache) out = stripCache(out);
  if (Array.isArray(out.tools)) {
    const before = out.tools.length;
    if (!c.webSearch()) out.tools = out.tools.filter((t: any) => !String(t?.type || '').startsWith('web_search'));
    // [zip41] the blind notice — a persona whose codex promises live web access will
    // otherwise PERFORM a check it cannot make (the staged "[silent check]" of
    // 2026-07-07). If we take the tool, we must tell them it's gone.
    if (out.tools.length < before) {
      const notice = '\n\n[NOTICE — your live web access is UNAVAILABLE right now. Anything your instructions say about searching or checking the web does not currently apply. Never claim, imply, or perform having checked, searched, or verified anything online. Where current information would matter, say plainly that you could not confirm it and proceed on general knowledge, honestly framed.]';
      if (typeof out.system === 'string') out.system = out.system + notice;
      else if (Array.isArray(out.system)) out.system = [...out.system, { type: 'text', text: notice }];
      else if (out.system === undefined) out.system = notice.trim();
    }
    if (out.tools.length === 0) delete out.tools;
  }
  return out;
}

// [zip36] firstText — extraction BY TYPE, never by position. Some providers return a
// leading non-text block (thinking, etc.); content[0] is a bet, find() is a law.
// [zip54g] THE DSML SCRUB — DeepSeek leaked raw '<\uFF5C\uFF5CDSML\uFF5C\uFF5C...' tool markup into a
// user-visible reply (Taiwan probe). The fullwidth bar never appears in honest prose;
// everything from its first occurrence is machine junk — truncate there.
// [zip54m] THE STREAM GATE — zip54g's scrub cleans the persisted reply, but the
// live stream had already put raw provider markup on screen. This factory wraps
// an emit path: the moment a marker enters the flowing text (fullwidth bar or
// ASCII '<|'), emission stops for good; the clean prefix of the very chunk that
// carries the marker still goes out.
export function makeStreamGate(): (d: string) => string | null {
  let tail = '';
  let closed = false;
  return (d: string) => {
    if (closed) return null;
    const probe = tail + d;
    const iBar = probe.indexOf('\uFF5C');
    const iAscii = probe.indexOf('<|');
    const hit = [iBar, iAscii].filter((i) => i > -1).sort((a, b) => a - b)[0];
    if (hit !== undefined) {
      closed = true;
      const cut = probe.lastIndexOf('<', hit);
      const clean = probe.slice(0, cut > -1 && hit - cut < 4 ? cut : hit);
      const emit = clean.slice(tail.length).trimEnd();
      tail = '';
      return emit.length ? emit : null;
    }
    tail = probe.slice(-3);   // keep a sliver so a marker split across chunks is still caught
    return d;
  };
}

export function scrubProviderMarkup(s: string): string {
  const i = s.indexOf('\uFF5C');
  if (i === -1) return s;
  const cut = s.lastIndexOf('<', i);
  return s.slice(0, cut > -1 && i - cut < 4 ? cut : i).trimEnd();
}

export function firstText(msg: any): string {
  const c = msg?.content;
  if (!Array.isArray(c)) return '';
  const b = c.find((x: any) => x && x.type === 'text');
  return typeof b?.text === 'string' ? b.text : '';
}

// [zip54g] PERSONA PINS — trades whose ground truth cannot ride a stale or filtered
// index. World affairs is Haiku's, always (Dev ruling, battery-proven 2026-07-07).
const PROVIDER_PINS: Record<string, ProviderKey> = {
  the_anchor: 'anthropic',
  the_grandmaster: 'anthropic',
  the_oracle: 'anthropic',   // [zip54m] his readings ride Haiku's web, always (Dev ruling)
  the_diva: 'anthropic',   // [zip54n] her hunts died in DeepSeek's tool loop — the whole room rides the seeing lane
};
export function pinnedProvider(personaKey?: string | null): ProviderKey | null {
  return (personaKey && PROVIDER_PINS[personaKey]) || null;
}

// [zip54g] VISION ROUTE — DeepSeek's gateway silently replaces images with
// '[Unsupported Image]' and the model reasons around the placeholder (probe-proven).
// Image-bearing calls route to Anthropic; with no Anthropic key, WE strip the image
// and say so, loudly, so no persona ever performs sight.
function hasImageBlocks(params: any): boolean {
  return Array.isArray(params?.messages) && params.messages.some((m: any) =>
    Array.isArray(m?.content) && m.content.some((b: any) => b?.type === 'image'));
}
const BLIND_SIGHT = '\n\n[NOTICE — an image was sent but you CANNOT SEE IT: no vision is available right now. Say plainly that you cannot view the image and ask them to describe it. Never describe, analyse, or pretend to have seen it.]';
function stripImages(params: any): any {
  const q = { ...params };
  q.messages = q.messages.map((m: any) => !Array.isArray(m?.content) ? m : {
    ...m,
    content: (() => {
      const kept = m.content.filter((b: any) => b?.type !== 'image');
      return kept.length ? kept : [{ type: 'text', text: '[the person sent an image you cannot see]' }];
    })(),
  });
  if (typeof q.system === 'string') q.system = q.system + BLIND_SIGHT;
  else if (Array.isArray(q.system)) q.system = [...q.system, { type: 'text', text: BLIND_SIGHT }];
  else q.system = BLIND_SIGHT.trim();
  return q;
}
function route(params: any): { p: ProviderKey; q: any } {
  let q = { ...params };
  const pin = q.__pin as ProviderKey | undefined;
  delete q.__pin;
  let p: ProviderKey = (pin && CONF[pin]) ? pin : llmProvider();
  if (hasImageBlocks(q)) {
    if (process.env.ANTHROPIC_API_KEY) p = 'anthropic';   // the seeing lane
    else q = stripImages(q);                               // honest blindness
  }
  return { p, q };
}

// The facade — a drop-in for the per-file `const anthropic = new Anthropic(...)`.
// Same call shapes (.messages.create / .messages.stream), provider-routed.
// [zip54g] pins + vision route in front of translation.
export function llm() {
  return {
    messages: {
      create: (params: any, opts?: any) => { const { p, q } = route(params); return clientFor(p).messages.create(translateFor(p, q), opts); },
      stream: (params: any, opts?: any) => { const { p, q } = route(params); return clientFor(p).messages.stream(translateFor(p, q), opts); },
    },
  };
}
