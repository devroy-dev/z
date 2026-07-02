// ════════════════════════════════════════════════════════════════════════
//  yourZ — TEMPORAL GROUNDING. Transcripts were timeless: a "rough day"
//  from Tuesday read as five minutes ago on Thursday. These helpers weave
//  human-readable gap markers into the history at assembly time (stored
//  messages stay untouched) and name the silence since the last exchange.
// ════════════════════════════════════════════════════════════════════════

export function gapLabel(ms: number): string | null {
  const h = ms / 3600e3;
  if (h < 3) return null;                                   // same sitting — say nothing
  if (h < 20) return 'a few hours later';
  if (h < 42) return 'the next day';
  const d = Math.round(h / 24);
  if (d < 7) return `${d} days later`;
  if (d < 14) return 'about a week later';
  if (d < 45) return `about ${Math.round(d / 7)} weeks later`;
  return `about ${Math.round(d / 30)} month${Math.round(d / 30) > 1 ? 's' : ''} later`;
}

// prefix a message's content with its gap marker when the silence was real
export function withGapMarker(content: string, prevAt: string | null, at: string | null): string {
  if (!prevAt || !at) return content;
  const label = gapLabel(new Date(at).getTime() - new Date(prevAt).getTime());
  return label ? `[${label}]\n${content}` : content;
}

// the line for the dynamic tail: how long since this conversation last breathed
export function sinceLine(lastAt: string | null): string {
  if (!lastAt) return '';
  const label = gapLabel(Date.now() - new Date(lastAt).getTime());
  if (!label) return '';
  return ` It has been ${label.replace(/ later$/, '')} since the previous exchange in this conversation — treat time honestly: "today" in older messages meant THAT day, and what was true then (a mood, a rough day, a plan) may have moved on. Ask, don't assume.`;
}
