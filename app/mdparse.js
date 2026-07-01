// ════════════════════════════════════════════════════════════════════════
//  yourZ — mdparse: pure markdown parsing for chat. No dependency, no regex
//  lookbehind (Hermes-safe). Logic unit-tested against real engine output.
//  Consumed by RichText.js. Handles exactly what Haiku emits:
//    **bold**   *italic* / _italic_   `code`   - / * / • bullets   1. lists
// ════════════════════════════════════════════════════════════════════════

// inline → array of runs: { t, b?, i?, code? }
export function parseInline(str) {
  const runs = [];
  let buf = '';
  const flush = (x) => { if (buf) { runs.push(Object.assign({ t: buf }, x || {})); buf = ''; } };
  let i = 0;
  while (i < str.length) {
    // **bold** (check the two-char marker before the single one)
    if (str[i] === '*' && str[i + 1] === '*') {
      const end = str.indexOf('**', i + 2);
      if (end > i + 1) { flush(); runs.push({ t: str.slice(i + 2, end), b: true }); i = end + 2; continue; }
    }
    // *italic* or _italic_ (non-empty, single line)
    if (str[i] === '*' || str[i] === '_') {
      const mk = str[i];
      const end = str.indexOf(mk, i + 1);
      if (end > i + 1 && str.slice(i + 1, end).indexOf('\n') === -1) {
        flush(); runs.push({ t: str.slice(i + 1, end), i: true }); i = end + 1; continue;
      }
    }
    // `code`
    if (str[i] === '`') {
      const end = str.indexOf('`', i + 1);
      if (end > i + 1) { flush(); runs.push({ t: str.slice(i + 1, end), code: true }); i = end + 1; continue; }
    }
    buf += str[i]; i++;
  }
  flush();
  return runs.length ? runs : [{ t: str }];
}

// block → array of { type:'p', text } | { type:'ul'|'ol', items[] }
export function parseBlocks(text) {
  const lines = String(text == null ? '' : text).replace(/\r/g, '').split('\n');
  const blocks = [];
  let para = [];
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join('\n') }); para = []; } };
  const bulletRe = /^[-*\u2022]\s+(.*)$/;
  const numRe = /^(\d+)[.)]\s+(.*)$/;
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') { flushPara(); i++; continue; }
    const bm = bulletRe.exec(t);
    const nm = numRe.exec(t);
    if (bm || nm) {
      flushPara();
      const ordered = !!nm && !bm;
      const items = [];
      while (i < lines.length) {
        const tt = lines[i].trim();
        if (tt === '') break;
        const b2 = bulletRe.exec(tt);
        const n2 = numRe.exec(tt);
        if (b2) items.push(b2[1]);
        else if (n2) items.push(n2[2]);
        else if (items.length) items[items.length - 1] += ' ' + tt; // wrapped continuation
        else break;
        i++;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    para.push(t);
    i++;
  }
  flushPara();
  return blocks;
}
