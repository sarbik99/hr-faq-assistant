import { promises as fs } from "fs";
import path from "path";
import { EmbeddedChunk } from "./types";

const INDEX_PATH = path.join(process.cwd(), "data", "index.json");

// In-memory index: the whole vector store is just this array.
let index: EmbeddedChunk[] = [];
let loaded = false;

// Load persisted chunks from disk once (lazily), so we don't re-embed
// on every server restart.
async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf-8");
    index = JSON.parse(raw) as EmbeddedChunk[];
  } catch {
    index = []; 
  }
  loaded = true;
}

async function persist(): Promise<void> {
  await fs.mkdir(path.dirname(INDEX_PATH), { recursive: true });
  await fs.writeFile(INDEX_PATH, JSON.stringify(index), "utf-8");
}

//Add newly embedded chunks to the index and persist to disk.
export async function addChunks(chunks: EmbeddedChunk[]): Promise<void> {
  await ensureLoaded();
  index.push(...chunks);
  await persist();
}

// No of chunks are currently indexed (used to detect if zero documents present)
export async function chunkCount(): Promise<number> {
  await ensureLoaded();
  return index.length;
}

// retrieval result: the chunk plus its similarity score to the query.
export interface ScoredChunk {
  chunk: EmbeddedChunk;
  score: number; // cosine similarity, roughly -1..1 (higher = more similar)
}

/**
 * Core search: compare queryVector against every stored chunk and
 * return the top K by cosine similarity.
 * Vectors are normalized by default, so cosine == dot product.
 */
export async function search(queryVector: number[], k: number): Promise<ScoredChunk[]> {
  await ensureLoaded();

  const scored: ScoredChunk[] = index.map((chunk) => ({
    chunk,
    score: dot(queryVector, chunk.vector),
  }));

  scored.sort((a, b) => b.score - a.score); // highest similarity first
  return scored.slice(0, k);
}

// Dot product = cosine similarity for unit-length vectors.
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
