import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/answer";

// POST /query  { "question": string }
// Response 200: { answer, citations[], refused, debug }
// Response 400: { error }          Response 500: { error }
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question =
    body && typeof (body as any).question === "string"
      ? (body as any).question.trim()
      : "";

  if (question.length === 0) {
    return NextResponse.json({ error: "Question must not be empty." }, { status: 400 });
  }

  try {
    const result = await answerQuestion(question);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Query error:", err);
    return NextResponse.json({ error: "Internal error during query." }, { status: 500 });
  }
}
