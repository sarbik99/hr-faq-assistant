import { GoogleGenerativeAI } from "@google/generative-ai";
import { LLMProvider } from "./types";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

export const geminiProvider: LLMProvider = {
  async generate(system: string, user: string): Promise<string> {
    if (!API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        temperature: 0,            // deterministic -> less hallucination
        responseMimeType: "application/json",
      },
      systemInstruction: system,
    });

    const result = await model.generateContent(user);
    return result.response.text(); 
  },
};


export const ollamaProvider: LLMProvider = {
  async generate(system: string, user: string): Promise<string> {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        // format:"json" asks Ollama to constrain output to valid JSON.
        format: "json",
        // temperature 0 -> deterministic, less "creative" -> less hallucination.
        options: { temperature: 0 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    return data.message?.content ?? "";
  },
};

export function getProvider(): LLMProvider {
  const choice = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();//default ollama
  console.log(`[LLM] provider = ${process.env.LLM_PROVIDER ?? "ollama"}`);
  switch (choice) {
    case "gemini":
      return geminiProvider;
    case "ollama":
      return ollamaProvider;
    default:
      throw new Error(`Unknown LLM_PROVIDER "${choice}". Use "gemini" or "ollama".`);
  }
}