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
    webSearch: () => false,
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
    web: { active: deepseekWeb(), override: _webOverride, env: process.env.DEEPSEEK_WEB === '1' },
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

function translate(params: any): any {
  const p = llmProvider();
  if (p === 'anthropic') return params;
  const c = CONF[p];
  let out = { ...params, model: c.model(String(params?.model || '')) };
  if (c.noThink && out.thinking === undefined) out.thinking = { type: 'disabled' };   // no muttering — callers may still opt in explicitly
  if (!c.cache) out = stripCache(out);
  if (Array.isArray(out.tools)) {
    if (!c.webSearch()) out.tools = out.tools.filter((t: any) => !String(t?.type || '').startsWith('web_search'));
    if (out.tools.length === 0) delete out.tools;
  }
  return out;
}

// [zip36] firstText — extraction BY TYPE, never by position. Some providers return a
// leading non-text block (thinking, etc.); content[0] is a bet, find() is a law.
export function firstText(msg: any): string {
  const c = msg?.content;
  if (!Array.isArray(c)) return '';
  const b = c.find((x: any) => x && x.type === 'text');
  return typeof b?.text === 'string' ? b.text : '';
}

// The facade — a drop-in for the per-file `const anthropic = new Anthropic(...)`.
// Same call shapes (.messages.create / .messages.stream), provider-routed.
export function llm() {
  return {
    messages: {
      create: (params: any, opts?: any) => clientFor(llmProvider()).messages.create(translate(params), opts),
      stream: (params: any, opts?: any) => clientFor(llmProvider()).messages.stream(translate(params), opts),
    },
  };
}
