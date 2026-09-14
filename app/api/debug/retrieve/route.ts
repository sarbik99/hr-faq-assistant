import { NextRequest, NextResponse } from "next/server";
import { retrieve } from "@/lib/retrieve";

// GET /api/debug/retrieve?q=...&k=4.
// Returns the retrieved chunks + scores
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const k = Number(req.nextUrl.searchParams.get("k") ?? 4);

  const { query, results, totalIndexed } = await retrieve(q, k);

  return NextResponse.json({
    query,
    totalIndexed,
    retrieved: results.map((r) => ({
      score: Number(r.score.toFixed(4)),          // similarity score
      document: r.chunk.metadata.documentName,    // for citation
      section: r.chunk.metadata.section,          // for citation
      chunkId: r.chunk.metadata.chunkId,
      text: r.chunk.text,                          // visible to the LLM
    })),
  });
}
