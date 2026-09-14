import { z } from "zod";

// The exact shape we require from the LLM and return to clients.
export const CitationSchema = z.object({
  document: z.string(),
  section: z.string(),
});

export const AnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
});

export type Citation = z.infer<typeof CitationSchema>;
export type Answer = z.infer<typeof AnswerSchema>;

export const REFUSAL_MESSAGE =
  "I don't have enough information in the available HR policies. Please contact HR.";
