// A single logical section of a document
export interface ParsedSection {
  section: string;   
  text: string;     
}

export interface ParsedDocument {
  documentName: string;     
  sections: ParsedSection[]; 
}

export class IngestionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "IngestionError";
  }
}

// Metadata attached to every chunk which makes citations possible.
export interface ChunkMetadata {
  documentName: string; // citation "document"
  section: string;      //  citation "section"
  chunkId: string;      // unique id
}

// before embedding chunk
export interface Chunk {
  metadata: ChunkMetadata;
  text: string;
}

//chunk added with its vector after embedding
export interface EmbeddedChunk extends Chunk {
  vector: number[]; // 384 numbers from all-MiniLM-L6-v2
}
