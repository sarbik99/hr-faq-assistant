import { retrieve } from "./retrieve";
import { getProvider } from "./llm";
import { buildSystemPrompt, buildUserPrompt } from "./ground";
import { AnswerSchema, Answer, REFUSAL_MESSAGE } from "./schema";
import { ScoredChunk } from "./store";

// thresold of top similarity score, we treat retrieval as "nothing relevant"
// and refuse without calling the LLM.
const MIN_SCORE = 0.15;
const K = 8;

export interface AnswerResult extends Answer {
  refused: boolean;
  // Debug info
  debug: {
    topScore: number | null;
    retrieved: { document: string; section: string; chunkId: string; score: number }[];
  };
}

function refusal(retrieved: ScoredChunk[]): AnswerResult {
  return {
    answer: REFUSAL_MESSAGE,
    citations: [],
    refused: true,
    debug: {
      topScore: retrieved[0]?.score ?? null,
      retrieved: retrieved.map((r) => ({
        document: r.chunk.metadata.documentName,
        section: r.chunk.metadata.section,
        chunkId: r.chunk.metadata.chunkId,
        score: Number(r.score.toFixed(4)),
      })),
    },
  };
}

export async function answerQuestion(question: string): Promise<AnswerResult> {
  const { results } = await retrieve(question, K);

  console.log("GATE INPUT:", {
    length: results.length,
    first: results[0]?.score,
    MIN_SCORE,
    willRefuse: results.length === 0 || results[0]?.score < MIN_SCORE,
  });
  // if nothing retrieved or top score is below thresold refuse
  if (results.length === 0 || results[0].score < MIN_SCORE) {
    console.log("--> REFUSED AT GATE");
    return refusal(results);
  }
  console.log("--> GATE PASSED, calling LLM");

 
  const system = buildSystemPrompt();
  const user = buildUserPrompt(question, results);

  let raw: string;
  try {
    raw = await getProvider().generate(system, user);
    console.log("RAW LLM OUTPUT:", raw);
  } catch(e) {
    // llm unavailable/failed -> refuse safely rather than crash.
    console.log("!!! LLM ERROR:", e);   // add this
    return refusal(results);
  }

  //Validate structured output
  let parsed: Answer;
  try {
    parsed = AnswerSchema.parse(JSON.parse(raw));
  } catch {
    // any error or non-JSON output -> refuse safely.
    return refusal(results);
  }

    // Verify + repair citations against the ACTUAL retrieved chunks.
  // Normalized, partial matching -> tolerant of formatting differences
  // in section names (e.g. "Casual leave" vs "2.1 Casual leave (CL)").
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const retrievedMeta = results.map((r) => ({
    document: r.chunk.metadata.documentName,
    section: r.chunk.metadata.section,
    ndoc: norm(r.chunk.metadata.documentName),
    nsec: norm(r.chunk.metadata.section),
  }));

  const verifiedCitations: { document: string; section: string }[] = [];
  const seen = new Set<string>();

  for (const c of parsed.citations) {
    const cdoc = norm(c.document);
    const csec = norm(c.section);
    const hit = retrievedMeta.find(
      (m) =>
        (m.ndoc === cdoc || cdoc === "" || cdoc.includes(m.ndoc) || m.ndoc.includes(cdoc)) &&
        (m.nsec === csec || m.nsec.includes(csec) || csec.includes(m.nsec))
    );
    if (hit) {
      const key = `${hit.document}|||${hit.section}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Return the REAL section string, never the model's paraphrase.
        verifiedCitations.push({ document: hit.document, section: hit.section });
      }
    }
  }

  // If the model answered but has no valid citations, treat as refusal.
  // An answer with no real source is not grounded.
  const isRefusalText = parsed.answer.trim() === REFUSAL_MESSAGE;
  if (!isRefusalText && verifiedCitations.length === 0) {
    return refusal(results);
  }

  return {
    answer: parsed.answer,
    citations: verifiedCitations,
    refused: isRefusalText,
    debug: {
      topScore: Number(results[0].score.toFixed(4)),
      retrieved: results.map((r) => ({
        document: r.chunk.metadata.documentName,
        section: r.chunk.metadata.section,
        chunkId: r.chunk.metadata.chunkId,
        score: Number(r.score.toFixed(4)),
      })),
    },
  };
}
