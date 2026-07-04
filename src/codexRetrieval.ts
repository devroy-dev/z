// codexRetrieval.ts — the Donna toolset for the adjudicator: an index of a codex's
// sections, and a slicer to pull one section on demand. Ported from thedreamai's
// battle-tested handbook slicer (which tolerates §N, §N.M, ## Chapter N, bolded
// markers) and EXTENDED to also handle plain "## N. Title" headings (how the debate
// codexes are authored). Marker-agnostic by design: any future codex, any heading
// style, retrieves without breakage.

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract a compact INDEX (section id + title) from a codex, whatever its heading
// style. The model sees this to know what it can consult. Order preserved.
export function extractIndex(md: string): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const raw of md.split('\n')) {
    const ln = raw.trim();
    // "## 5. The central debates"  → id 5
    let m = ln.match(/^#{1,4}\s+(\d+(?:\.\d+)?)[.)]?\s+(.+)$/);
    if (m) { out.push({ id: m[1], title: m[2].replace(/[—-]\s*$/, '').trim() }); continue; }
    // "## §5 — ..."  or  "### §5.3 — ..."
    m = ln.match(/^#{1,4}\s*§\s*(\d+(?:\.\d+)?)\s*[—-]?\s*(.*)$/);
    if (m) { out.push({ id: m[1], title: (m[2] || '').trim() }); continue; }
    // "**§5.3 — ...**" bolded inline
    m = ln.match(/^\*\*\s*§\s*(\d+(?:\.\d+)?)\s*[—-]?\s*(.*?)\*\*$/);
    if (m) { out.push({ id: m[1], title: (m[2] || '').trim() }); continue; }
    // "## Chapter 7 — ..."
    m = ln.match(/^#{1,4}\s+Chapter\s+(\d+)\s*[—-]?\s*(.*)$/i);
    if (m) { out.push({ id: m[1], title: (m[2] || `Chapter ${m[1]}`).trim() }); continue; }
  }
  return out;
}

export function indexAsText(idx: { id: string; title: string }[]): string {
  return idx.map((s) => `  ${s.id}. ${s.title}`).join('\n');
}

// Pure slicer — pull the section for a ref ("5", "§5", "5.3", "Chapter 7", "Appendix C").
// Format-tolerant across all authored styles. Returns null if not found.
export function sliceSection(md: string, refRaw: string): string | null {
  const lines = md.split('\n');
  const ref = refRaw.trim();

  // any section marker at all — used to know where a section ends
  const ANY_MARKER = /^(#{1,4}\s*§?\s*\d+[.)]?(?:\.\d+)?(\s|$)|#{1,4}\s+(HALF|Appendix|Chapter)\b|\*\*\s*§\s*\d)/i;

  const secMatch = ref.match(/^§?\s*(\d+(?:\.\d+)?)/);
  if (secMatch) {
    const id = secMatch[1];
    // opener matches: "## 5. ", "## §5 —", "### §5.3", "**§5.3 —**", "## 5 " — id followed by non-digit
    const open = new RegExp(
      `(^#{1,4}\\s*§?\\s*${escapeRe(id)}(?!\\d)|^\\*\\*\\s*§\\s*${escapeRe(id)}(?!\\d))`,
    );
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (open.test(lines[i].trim()) && /^#{1,4}|\*\*/.test(lines[i].trim())) { start = i; break; }
    }
    if (start < 0) return null;
    const isSub = id.includes('.');
    const result: string[] = [lines[start]];
    for (let i = start + 1; i < lines.length; i++) {
      const ln = lines[i].trim();
      if (isSub) {
        if (ANY_MARKER.test(ln)) break;
      } else {
        // top-level section: stop at the next top-level marker (not its own subsections)
        if (/^#{1,4}\s*§?\s*\d+[.)]?(\s|$)/.test(ln) && !ln.match(new RegExp(`^#{1,4}\\s*§?\\s*${escapeRe(id)}\\.`))) break;
        if (/^#{1,2}\s+(HALF|Appendix|Chapter)\b/i.test(ln)) break;
      }
      result.push(lines[i]);
    }
    const text = result.join('\n').trim();
    return text || null;
  }

  // Chapter / Appendix fallbacks (thedreamai styles)
  const chMatch = ref.match(/^(?:chapter|ch)\.?\s*(\d+)$/i);
  if (chMatch) {
    const n = chMatch[1];
    return grab(lines, new RegExp(`^#{1,4}\\s+Chapter ${escapeRe(n)}(\\D|$)`, 'i'), ['## ', '# ']);
  }
  const apMatch = ref.match(/^(?:appendix\s*)?([A-I])$/i);
  if (apMatch) {
    const letter = apMatch[1].toUpperCase();
    return grab(lines, new RegExp(`^#{2,4} (?:Appendix )?${escapeRe(letter)}[\\.\\s]`), ['### ', '## ', '# ']);
  }
  return null;
}

function grab(lines: string[], header: RegExp, stops: string[]): string | null {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i])) { start = i; break; }
  }
  if (start < 0) return null;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    if (stops.some((s) => lines[i].startsWith(s))) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}
