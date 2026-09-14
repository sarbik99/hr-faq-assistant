import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";
import { Chunk, EmbeddedChunk } from "./types";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2"; // 384-dim, local

// Load the modle once and reuse it. Loading is expensive (downloads +
// initializes weights on first run), so we cache the promise.
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return extractorPromise;
}

//same model for embedding chunks and queries
export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  // pooling: "mean" -> average token vectors into one sentence vector.
  // normalize: true -> unit length, so cosine similarity is well-behaved.
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}


// embeds many chunks. Attaches the vector to each chunk's metadata/text.
 
export async function embedChunks(chunks: Chunk[]): Promise<EmbeddedChunk[]> {
  const embedded: EmbeddedChunk[] = [];
  for (const chunk of chunks) {
    const vector = await embedText(chunk.text);
    embedded.push({ ...chunk, vector });
  }
  return embedded;
}
