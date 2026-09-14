import { ParsedDocument, Chunk } from "./types";

const TARGET_CHARS = 500; // one complete HR policy point
const OVERLAP_CHARS = 80; // one sentence carried into the next chunk

/**
 * Turns a ParsedDocument into chunks + metadata.
 * Chunks nevr cross section boundaries, so each chunk has a correct
 * section for its citation.
 */
export function chunkDocument(doc: ParsedDocument): Chunk[] {
  const chunks: Chunk[] = [];

  for (const sec of doc.sections) {
    const pieces = chunkText(sec.text);
    pieces.forEach((text, i) => {
      chunks.push({
        text,
        metadata: {
          documentName: doc.documentName,
          section: sec.section,
          // Deterministic easy to read id
          chunkId: `${doc.documentName}#${sec.section}#${i}`,
        },
      });
    });
  }

  return chunks;
}


function chunkText(text: string): string[] {
  // Split into sentences 
  const sentences = text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+|\S+$/g) ?? [text];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;

    // if adding this sentence would overflow, close the current chunk.
    if (current.length + s.length + 1 > TARGET_CHARS && current.length > 0) {
      chunks.push(current.trim());
      // start next chunk with the tail of the previous one (overlap).
      current = tail(current, OVERLAP_CHARS) + " " + s;
    } else {
      current = current ? current + " " + s : s;
    }
  }

  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

// returning the last `n` chars of `s`, snapped to a word boundary so
// overlap doesn't start mid-word.
function tail(s: string, n: number): string {
  if (s.length <= n) return s;
  const slice = s.slice(s.length - n);
  const space = slice.indexOf(" ");
  return space === -1 ? slice : slice.slice(space + 1);
}
