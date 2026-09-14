# HR FAQ & Policy Assistant — Design

A Retrieval-Augmented Generation (RAG) service that answers employee HR
questions **only** from uploaded policy documents, with citations, and
refuses when the policies do not contain the answer.

## 1. Architecture

### Components
- **Parser** (`lib/parse.ts`) — validates and extracts text + sections from `.md`/`.txt`.
- **Chunker** (`lib/chunk.ts`) — splits sections into overlapping, citation-tagged chunks.
- **Embedder** (`lib/embed.ts`) — local `all-MiniLM-L6-v2` (Transformers.js), 384-dim vectors.
- **Vector store** (`lib/store.ts`) — in-memory array + cosine search, persisted to `data/index.json`.
- **Retriever** (`lib/retrieve.ts`) — query → embedding → top-K similarity search.
- **Grounding** (`lib/ground.ts`) — builds the constrained prompt from retrieved chunks.
- **LLM provider** (`lib/llm.ts`) — pluggable: local Ollama or hosted Gemini.
- **Answer pipeline** (`lib/answer.ts`) — gate → generate → validate → verify citations → cite/refuse.
- **API** (`app/api/documents`, `app/api/query`, `app/api/debug/retrieve`).
- **UI** (`app/page.tsx`) — minimal upload + ask interface.

### Data flow

Ingestion:
Upload → Validate → Parse (sections) → Chunk (+metadata) → Embed → Index (persist)

Query:
Question → Embed → Similarity search (top-K) → Score gate →
Grounded prompt → LLM → JSON validation (Zod) → Citation verification →
Answer + citations OR refusal

## 2. Chunking & Retrieval

- **Chunking strategy:** section-aware. We split documents by heading first,
  then chunk *within* each section (~500 chars, ~80-char overlap, sentence
  boundaries). Chunks never cross sections, so each chunk carries an accurate
  section for citation.
- **Metadata:** every chunk stores `documentName`, `section`, `chunkId`, and
  its text. Metadata is what makes citations possible and travels through the
  whole pipeline.
- **Top-K:** K=8. HR questions can span multiple sections (e.g. casual + sick +
  privilege leave), so a small K would drop needed facts. K=8 balances recall
  against prompt noise.
- **Ranking:** cosine similarity (dot product on normalized vectors).
- **Why these choices:** HR policies are short, atomic rules; medium-small
  section-bounded chunks maximize both retrieval precision and citation
  accuracy.

## 3. Grounding

- **Hallucination prevention:** the LLM only ever receives retrieved chunks
  plus strict instructions to use only that context. It is told to refuse when
  the context is insufficient, and to treat explicit negatives ("not covered")
  as valid answers rather than refusals.
- **Prompt constraints:** role definition, numbered context, "no outside
  knowledge," refusal instruction, exact-citation instruction, JSON-only output.
- **When retrieval is weak:** a deterministic **score gate** (`MIN_SCORE=0.15`)
  refuses obviously-irrelevant queries *before* calling the LLM. For
  HR-adjacent-but-absent queries that pass the gate, the LLM's grounded refusal
  is the second layer.
- **Refusal (three layers):** (1) score gate, (2) LLM prompt-driven refusal,
  (3) citation verification — a non-refusal answer with zero valid citations is
  downgraded to a refusal. Plus fail-safe refusal on LLM error/malformed output.
- **Limitation:** the second layer is probabilistic; a weaker model could
  occasionally over-answer an absent-but-adjacent question.

## 4. Schema & APIs

- `POST /documents` (multipart `file`) → `{ documentName, sectionCount, chunkCount, message }`.
- `POST /query` `{ question }` → `{ answer, citations: [{document, section}], refused, debug }`.
- `GET /api/debug/retrieve?q=&k=` → retrieved chunks + scores (inspectability).
- **Why this schema:** structured `{answer, citations[]}` lets the UI and any
  consumer rely on a fixed shape, and lets us programmatically verify citations
  against real chunks. Validated with Zod; malformed LLM output is rejected.

## 5. Trade-offs (considered and rejected)

1. **Hybrid keyword+vector retrieval — rejected.** Initially considered for a
   multi-fact failure, but the root cause was duplicate/contradictory source
   data. After cleanup, pure vector retrieval placed all relevant chunks in
   top-K (verified via the debug endpoint). Hybrid search would add two extra
   settings and require more tuning, without giving us any benefit on this dataset.
   I would consider it later if the dataset grows and exact-term queries start failing.
2. **Dedicated vector DB (Chroma/pgvector/sqlite-vec) — rejected.** Chose an
   in-memory array + cosine search so the retrieval logic is fully transparent
   and dependency-free. Acceptable for a handful of policies; would not scale to
   millions of chunks.
3. **Local-only LLM (Ollama) vs hosted (Gemini).** Local is free/private but
   slow on modest hardware; hosted is fast but adds API-key, quota, region, and
   model-deprecation risk (all encountered during development). Resolved by
   making the provider pluggable and defaulting to local, so neither is
   load-bearing.

## 6. What we would harden in two more weeks

- **Scale:** replace in-memory store with sqlite-vec or pgvector; add
  approximate-nearest-neighbor indexing.
- **PDF & table extraction:** proper PDF parsing and table-aware chunking
  (current tables work only because they fit in one chunk).
- **Evaluation:** expand the eval set; add retrieval-precision metrics and
  automated refusal/hallucination scoring.
- **Reliability:** retry/backoff on LLM rate limits; observability on refusals
  vs answers vs errors.
- **Auth & versioning:** real admin/employee roles; document versioning and
  targeted re-indexing/deletion (currently re-upload replaces a document's
  chunks).
- **Content validation:** detect corrupt-but-text files (currently accepted if
  non-empty).
