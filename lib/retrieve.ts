import { embedText } from "./embed";
import { search, chunkCount, ScoredChunk } from "./store";

const DEFAULT_K = 4; // top-K vectors to retieve: enough context, little noise, for short HR policies

export interface RetrievalResult {
  query: string;
  results: ScoredChunk[];
  totalIndexed: number; 
}


export async function retrieve(query: string, k: number = DEFAULT_K): Promise<RetrievalResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    // empti query: don't embed unnecessary things; return an empty, honest result.
    return { query, results: [], totalIndexed: await chunkCount() };
  }

  const totalIndexed = await chunkCount();
  if (totalIndexed === 0) {
    // If no documents uploaded yet: nothing to retrieve.
    return { query: trimmed, results: [], totalIndexed: 0 };
  }

  const queryVector = await embedText(trimmed); // using same model as chunks
  const results = await search(queryVector, k);
  return { query: trimmed, results, totalIndexed };
}
