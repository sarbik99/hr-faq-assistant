import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parse";
import { chunkDocument } from "@/lib/chunk";    
import { embedChunks } from "@/lib/embed";      
import { IngestionError } from "@/lib/types";
import { addChunks } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    let rawContent: string;
    try {
      rawContent = await file.text();
    } catch {
      return NextResponse.json({ error: "File could not be read." }, { status: 400 });
    }

    const parsed = parseDocument(file.name, rawContent);

    const chunks = chunkDocument(parsed);
    const embedded = await embedChunks(chunks);
    await addChunks(embedded); // persist into the vector index

return NextResponse.json({
  documentName: parsed.documentName,
  sectionCount: parsed.sections.length,
  chunkCount: embedded.length,
  chunks: embedded.map((c) => ({
        chunkId: c.metadata.chunkId,
        section: c.metadata.section,
        preview: c.text.slice(0, 100),
        vectorLength: c.vector.length,        // should be 384
        vectorSample: c.vector.slice(0, 5),   // first 5 numbers, just to see it's real
      })),
  message: `Indexed ${embedded.length} chunks.`,
});
  } catch (err) {
    if (err instanceof IngestionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Unexpected ingestion error:", err);
    return NextResponse.json({ error: "Internal error during upload." }, { status: 500 });
  }
}
