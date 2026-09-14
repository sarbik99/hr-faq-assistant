import { NextRequest, NextResponse } from "next/server";
import { parseDocument } from "@/lib/parse";
import { chunkDocument } from "@/lib/chunk";
import { embedChunks } from "@/lib/embed";
import { addChunks } from "@/lib/store";
import { IngestionError } from "@/lib/types";

// POST /documents  (multipart/form-data, field "file")
// Response 200: { documentName, sectionCount, chunkCount, message }
// Response 400: { error, code? }   Response 500: { error }
export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Expected multipart/form-data with a 'file' field." },
        { status: 400 }
      );
    }

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

    // parse -> chunk -> embed -> index
    const parsed = parseDocument(file.name, rawContent);
    const chunks = chunkDocument(parsed);
    const embedded = await embedChunks(chunks);
    await addChunks(embedded);

    return NextResponse.json({
      documentName: parsed.documentName,
      sectionCount: parsed.sections.length,
      chunkCount: embedded.length,
      message: `Indexed ${embedded.length} chunks from "${parsed.documentName}".`,
    });
  } catch (err) {
    if (err instanceof IngestionError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Unexpected ingestion error:", err);
    return NextResponse.json({ error: "Internal error during upload." }, { status: 500 });
  }
}
