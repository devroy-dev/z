// ════════════════════════════════════════════════════════════════════════
//  callmeZ — THE VERDICT CARD (phase 2b): the battlefield's share object.
//
//  The artifact that rides WhatsApp and pulls the next debater in — the same
//  growth class as the screenplay page and the pitch card. Rendered server-side
//  as a 1200×630 PNG (the og:image standard) so a shared verdict link UNFURLS
//  as the card itself; also downloadable as the share-PNG.
//
//  Typeset in the arena's register: near-black crimson ground, Fraunces for
//  the motion and the winner (the courtroom serif), Figtree for the apparatus.
//  Layout is deterministic — manual line-wrapping at measured character
//  budgets, no model, no browser, no layout engine: the card renders the same
//  bytes for the same verdict, forever.
//
//  OWNER-GATED: the aesthetic bar is the founder's. This module ships behind
//  the phase-2b review — the card's look does not go live without his eyes.
// ════════════════════════════════════════════════════════════════════════
import { Resvg } from '@resvg/resvg-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dir, 'content', 'battlefield', 'fonts');

const W = 1200, H = 630;
const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const CREAM = '#F5ECE1';
const GOLD = '#C9A86A';
const INK = '#120A0E';

const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// naive-but-stable wrap: budget = max chars per line at the given size (tuned
// for Fraunces/Figtree at our sizes on a 1096px column). Deterministic.
function wrap(text: string, budget: number, maxLines: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (cand.length <= budget) { cur = cand; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines - 1) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // ellipsis if we truncated
  const used = lines.join(' ').length;
  if (used < String(text || '').trim().length && lines.length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[.,;: ]+$/, '') + '…';
  }
  return lines;
}

export interface CardData {
  motion: string;
  winner: 'PRO' | 'CON';
  verdictLine: string;
  domain?: string | null;
  formatLabel?: string | null;
  sides: { side: string; names: string[] }[];
  crowd?: { pro: number; con: number; total: number } | null;
  date?: string | null;
  bestSpeakerName?: string | null;
}

export function buildCardSVG(d: CardData): string {
  const winColor = d.winner === 'PRO' ? BLUE : CRIMSON;
  const proNames = (d.sides?.find((s) => s.side === 'PRO')?.names || []).join(' · ') || 'PRO';
  const conNames = (d.sides?.find((s) => s.side === 'CON')?.names || []).join(' · ') || 'CON';
  const motionLines = wrap(d.motion, 52, 3);
  const verdictLines = wrap(d.verdictLine, 88, 2);
  const dateStr = d.date ? new Date(d.date).toDateString().replace(/^\w+ /, '') : '';
  const fmtTag = (d.formatLabel && d.formatLabel !== 'The Duel (1v1)') ? d.formatLabel.toUpperCase() : (d.domain ? String(d.domain).toUpperCase() : 'THE BATTLEFIELD');

  // vertical rhythm
  const motionY0 = 168;
  const motionLH = 62;
  const afterMotion = motionY0 + motionLines.length * motionLH;
  const winnerY = afterMotion + 66;
  const verdictY0 = winnerY + 52;
  const verdictLH = 34;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
  // ground: near-black with a crimson breath top-left, a hairline frame
  parts.push(`<defs>
    <radialGradient id="breath" cx="0.12" cy="0.0" r="1.1">
      <stop offset="0" stop-color="#2A0F17"/><stop offset="0.5" stop-color="#190B10"/><stop offset="1" stop-color="${INK}"/>
    </radialGradient>
  </defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#breath)"/>`);
  parts.push(`<rect x="26" y="26" width="${W - 52}" height="${H - 52}" fill="none" stroke="rgba(224,87,111,0.28)" stroke-width="1.5"/>`);
  // the swords mark + kicker
  parts.push(`<g transform="translate(52,58)" stroke="${CRIMSON}" stroke-width="2.2" fill="none" stroke-linecap="round"><path d="M2 2l26 26M0 5l3-3 5 5-3 3zM36 2L10 28M38 5l-3-3-5 5 3 3z"/></g>`);
  parts.push(`<text x="104" y="86" font-family="Figtree" font-weight="600" font-size="21" letter-spacing="7" fill="${CRIMSON}">THE ADJUDICATOR RULED</text>`);
  parts.push(`<text x="${W - 52}" y="86" text-anchor="end" font-family="Figtree" font-weight="600" font-size="18" letter-spacing="4" fill="rgba(245,236,225,0.45)">${esc(fmtTag)}</text>`);
  // the motion — the card's face
  motionLines.forEach((ln, i) => {
    parts.push(`<text x="52" y="${motionY0 + i * motionLH}" font-family="Fraunces" font-style="italic" font-size="46" fill="${CREAM}">${esc(i === 0 ? '“' + ln : ln)}${i === motionLines.length - 1 ? '”' : ''}</text>`);
  });
  // the winner
  parts.push(`<text x="52" y="${winnerY}" font-family="Fraunces" font-size="54" fill="${CREAM}"><tspan fill="${winColor}">${d.winner}</tspan> takes the floor</text>`);
  // the verdict line
  verdictLines.forEach((ln, i) => {
    parts.push(`<text x="52" y="${verdictY0 + i * verdictLH}" font-family="Fraunces" font-style="italic" font-size="24" fill="rgba(245,236,225,0.82)">${esc(ln)}</text>`);
  });
  // the footer strip: sides · crowd · date · wordmark
  const footY = H - 78;
  parts.push(`<line x1="52" y1="${footY - 34}" x2="${W - 52}" y2="${footY - 34}" stroke="rgba(245,236,225,0.14)" stroke-width="1"/>`);
  parts.push(`<text x="52" y="${footY}" font-family="Figtree" font-weight="600" font-size="19" letter-spacing="2"><tspan fill="${BLUE}">PRO</tspan><tspan fill="rgba(245,236,225,0.75)" dx="10">${esc(wrap(proNames, 26, 1)[0] || '')}</tspan><tspan fill="rgba(245,236,225,0.35)" dx="18">vs</tspan><tspan fill="${CRIMSON}" dx="18">CON</tspan><tspan fill="rgba(245,236,225,0.75)" dx="10">${esc(wrap(conNames, 26, 1)[0] || '')}</tspan></text>`);
  const crowdBit = (d.crowd && d.crowd.total > 0) ? `the room: ${d.crowd.pro}–${d.crowd.con} · ` : '';
  const bestBit = d.bestSpeakerName ? `★ ${d.bestSpeakerName} · ` : '';
  parts.push(`<text x="52" y="${footY + 32}" font-family="Figtree" font-size="16" fill="rgba(245,236,225,0.42)">${esc(bestBit + crowdBit + dateStr)}</text>`);
  parts.push(`<text x="${W - 52}" y="${footY + 30}" text-anchor="end" font-family="Fraunces" font-size="26" fill="${GOLD}">callmeZ</text>`);
  parts.push(`<text x="${W - 52}" y="${footY - 2}" text-anchor="end" font-family="Figtree" font-weight="600" font-size="15" letter-spacing="3" fill="rgba(201,168,106,0.65)">SETTLE IT ON THE BATTLEFIELD</text>`);
  parts.push('</svg>');
  return parts.join('\n');
}

export function renderCardPNG(d: CardData): Buffer {
  const svg = buildCardSVG(d);
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      fontDirs: [FONT_DIR],
      defaultFontFamily: 'Figtree',
      loadSystemFonts: false,
    },
  });
  return Buffer.from(r.render().asPng());
}
