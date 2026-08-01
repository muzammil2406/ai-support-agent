-- pgvector setup for the FAQ knowledge base.
-- Run once against the Neon database (e.g. via `psql` or the Neon SQL editor),
-- or reference these statements inside the first migration before the index is needed.

-- 1) Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) ivfflat index for approximate cosine-similarity search.
--    ivfflat is ideal for this workload (<100k rows): it gives fast ANN queries
--    without loading any data into memory.  `lists` should be ~= sqrt(rows);
--    with ~20 FAQ rows, the practical minimum of 10 lists is appropriate.
--    For small tables Postgres may prefer a seq scan anyway — that's fine and
--    keeps memory pressure at zero; the index is in place so queries remain
--    fast as the KB grows.
CREATE INDEX IF NOT EXISTS faq_entries_embedding_idx
  ON faq_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- 3) (Optional, recommended) enable HNSW if the FAQ KB ever grows past ~10k rows:
--    CREATE INDEX faq_entries_embedding_hnsw_idx
--      ON faq_entries USING hnsw (embedding vector_cosine_ops);
