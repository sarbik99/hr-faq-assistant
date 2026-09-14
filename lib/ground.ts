import { ScoredChunk } from "./store";
import { REFUSAL_MESSAGE } from "./schema";

// the system prompt: the model's role + hard rules.
export function buildSystemPrompt(): string {
  return [
    "You are an internal HR policy assistant.",
    "You must answer ONLY using the numbered policy excerpts provided in the user message.",
    "Do NOT use any outside or general knowledge.",
    "If the excerpts explicitly state that something is NOT allowed, NOT covered, or NOT reimbursable, that IS an answer: say so clearly and cite it. Do NOT refuse in that case.",
    "If the question is broad, combine relevant excerpts into one answer and cite each one used.",
    "Only refuse if the excerpts contain NO information relevant to the question.",
    `To refuse, set "answer" to exactly: "${REFUSAL_MESSAGE}" and "citations" to an empty array.`,
    "When you answer, cite ONLY the excerpts you actually used, using their exact document and section values.",
    "Never invent citations. Never cite an excerpt you did not use.",
    'Respond with ONLY a JSON object: {"answer": string, "citations": [{"document": string, "section": string}]}.',
  ].join("\n");
}


// the user prompt: the numbered context + the question.
export function buildUserPrompt(question: string, chunks: ScoredChunk[]): string {
  const context = chunks
    .map((c, i) => {
      const m = c.chunk.metadata;
      return [
        `[Excerpt ${i + 1}]`,
        `document: ${m.documentName}`,
        `section: ${m.section}`,
        `text: ${c.chunk.text}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Policy excerpts:",
    context,
    "",
    `Question: ${question}`,
    "",
    "Answer using ONLY the excerpts above. If they are insufficient, refuse as instructed.",
  ].join("\n");
}
