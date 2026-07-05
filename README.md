# Coach Layer 3 — RAG INGEST (sub-step A of the dreamai port) — SERVER

Bring-your-own-material, part 1: upload a study PDF → distill into a §-numbered, page-anchored
BRIEF (with declared gaps) → per-§ index (FTS + Voyage embedding) → ready for fused retrieval.
Ported native to schema z (runtime never touches dreamai). Salvage walker unit-verified (6/6);
real tsc passes. Uses VOYAGE_API_KEY (already in Railway).

## Contents
- 0040_coach_rag.sql — documents + briefs + brief_sections (FTS+vector) + sync trigger + fused RPC
- coachEmbed.ts      — the Voyage embedding door (swappable provider)
- coachDistill.ts    — the STUDY CLERK: PDF → §-indexed Brief (Sonnet, native PDF read, salvage)
- apply_rag.py       — places files + wires 2 endpoints

## Apply — SQL FIRST
    unzip -o coach-rag-ingest.zip
    # 1) run 0040_coach_rag.sql in Supabase (creates the vector extension, tables, trigger, RPC)
    # 2) from repo root:
    python3 apply_rag.py
    npm run build && git add -A && git commit -m "coach L3: RAG ingest (upload+distill+embed)" && git push

## Test (curl) — upload a study PDF into a course, then inspect the shelf
    # start a course first (or reuse one); then upload a PDF:
    B64=$(base64 -w0 /path/to/chapter.pdf)
    curl -s -X POST "$BASE/coach/$CID/material" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d "{\"filename\":\"chapter.pdf\",\"dataB64\":\"$B64\"}"; echo
    # → { briefId, title, pages, sectionsCount, declaredGaps, costInr, truncated }

    curl -s "$BASE/coach/$CID/shelf" -H "Authorization: Bearer $TOKEN"; echo
    # → { briefs: [{ id, title, pages, sections, declaredGaps }] }

## What to look for
- the distill returns a real title + a sensible sectionsCount for the PDF
- declaredGaps names anything it couldn't read (scanned diagrams etc.) — never fakes coverage
- costInr is the one-time Sonnet clerk cost (~₹ a few per doc); after this it's Haiku forever
- in Supabase: z.coach_brief_sections rows exist for the brief, and `embedding` fills in (Voyage)

## Next (sub-step B): retrieval + the find tools + the coach TEACHES/QUIZZES from your material
  (donna_shelf / brief_read / pdf_source_read equivalents; grounds lessons+MCQs in the Brief with
  §/page citations). Bucket 'coach-docs' is auto-created on first upload.
