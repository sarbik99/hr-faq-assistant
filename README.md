# HR FAQ & Policy Assistant

A small **Retrieval-Augmented Generation (RAG)** service for answering employee HR questions from uploaded policy documents.

The assistant:

* Answers **only from uploaded policies**
* Uses semantic search to retrieve relevant policy sections
* Returns **document + section citations**
* Refuses when the policies do not contain the answer
* Validates the LLM response before returning it
* Runs embeddings locally and supports both **Ollama** and **Google Gemini** for generation

---

## Demo

🎥 **[Watch the 3–5 minute demo on YouTube](https://youtu.be/wCxZvqCK1DY)**

The demo shows the application workflow, including policy upload, question answering with citations, and refusal when the required information is not present in the uploaded policies.


## How It Works

### Document ingestion

```text
Upload → Parse → Chunk → Embed → Store
```

### Question answering

```text
Question
   ↓
Embed
   ↓
Retrieve Top-K Chunks
   ↓
Score Gate
   ↓
Grounded Prompt
   ↓
  LLM
   ↓
Validate JSON + Verify Citations
   ↓
Answer + Citations  OR  Refusal
```

The uploaded policies are the **source of truth**. The LLM receives the retrieved policy text along with instructions to use only that information.

---

## Tech Stack

| Part              | Technology                           |
| ----------------- | ------------------------------------ |
| Framework         | Next.js + TypeScript                 |
| Embeddings        | Transformers.js — `all-MiniLM-L6-v2` |
| Vector search     | In-memory array + cosine similarity  |
| Persistence       | JSON file                            |
| LLM               | Ollama or Google Gemini              |
| Output validation | Zod                                  |
| UI                | Next.js + Tailwind CSS               |

---

## Prerequisites

* Node.js **18+** (20+ recommended)
* npm
* One of the following LLM options:

  * **Ollama** — local, free, no API key
  * **Google Gemini** — hosted, faster, requires a free API key

The embedding model is downloaded automatically on first use and then cached locally.

---

## Installation and Setup

```bash
git clone https://github.com/sarbik99/hr-faq-assistant
cd hr-faq-assistant
npm install
```

```
Create your own .env file in the project root

copy paste the .env.example in your .env
and make sure to add a valid gemini api key
if using the gemini model (recommended)
```


## Configuration

### Option 1: Ollama

Ollama is the default option and does not require an API key.

Install Ollama, then download a model:

```bash
ollama pull qwen2.5:7b
```

Set:

```env
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

For a lighter/faster model, you can use:

```env
OLLAMA_MODEL=qwen2.5:3b
```

### Option 2: Google Gemini

Set:

```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

The Gemini API key can be obtained from Google AI Studio.

---

## Models

### Embeddings

The application always uses a local embedding model:

```text
Xenova/all-MiniLM-L6-v2
```

It produces **384-dimensional vectors** and runs locally after the model is downloaded.

### Generation

The final answer can be generated using:

* **Ollama** — `qwen2.5:7b`
* **Gemini** — `gemini-3.1-flash-lite`

The LLM provider is configurable, so the rest of the RAG pipeline does not depend on a specific provider.

---

## Running the Application

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## Uploading Policies

### Using the UI

Use the **Admin: Upload Policy** section to upload a `.md` or `.txt` policy file.

### Using the API

```bash
curl -F "file=@samples/leave-policy.md" \
  http://localhost:3000/api/documents
```

Sample HR policies are available in the `samples/` directory.

---

## Asking Questions

### Using the UI

Enter a question in the **Ask a Question** section.

### Using the API

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the casual leave carry-forward limit?"}'
```

Example response:

```json
{
  "answer": "A maximum of 8 days of unused casual leave may be carried forward.",
  "citations": [
    {
      "document": "leave-policy.md",
      "section": "4.1 Casual leave carry-forward"
    }
  ],
  "refused": false
}
```

The response always follows a structured format containing the answer, citations, and refusal status.

---

## Inspecting Retrieval

A debug endpoint is included to inspect which chunks were retrieved and their similarity scores.

```bash
curl "http://localhost:3000/api/debug/retrieve?q=casual+leave+carry+forward&k=5"
```

This is useful for understanding and debugging the retrieval stage **without calling the LLM**.

---

## Evaluation

Run the application first and upload the sample policies.

In another terminal:

```bash
npm run eval
```

To run the evaluation using Ollama and avoid Gemini API limits:

```bash
LLM_PROVIDER=ollama npm run eval
```

The evaluation set covers:

* Direct factual questions
* Multi-fact questions
* Questions requiring multiple sections
* Table/structured information
* Questions where the answer is absent
* Off-topic questions
* Empty questions
* Ambiguous questions

The evaluation checks answer correctness, refusal behavior, and citation sections.

---

## Example Questions

| Question                                                                | Expected behavior                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------ |
| What is the casual leave carry-forward limit?                           | Answer + citation                                      |
| How many casual, sick, and privilege leave days are available per year? | Answer using multiple sections + citations             |
| Does the Standard tier cover dental implants?                           | Answer from the benefits table + citation              |
| Can I get reimbursed for home gym equipment?                            | Answer/refusal based on the policy + citation          |
| What is the stock option vesting schedule?                              | Refusal because the policy does not contain the answer |
| *(empty question)*                                                      | Clean `400` error                                      |

---

## Project Structure

```text
hr-faq-assistant/
│
├── app/
│   ├── api/
│   │   ├── documents/
│   │   │   └── route.ts          # Upload + ingestion
│   │   ├── query/
│   │   │   └── route.ts          # Question answering
│   │   └── debug/
│   │       └── retrieve/
│   │           └── route.ts       # Retrieval inspection
│   │
│   └── page.tsx                   # Minimal UI
│
├── lib/
│   ├── parse.ts                   # Document parsing
│   ├── chunk.ts                   # Section-aware chunking
│   ├── embed.ts                   # Local embeddings
│   ├── store.ts                   # Vector storage + search
│   ├── retrieve.ts                # Top-K retrieval
│   ├── ground.ts                  # Grounded prompt
│   ├── llm.ts                     # LLM providers
│   ├── schema.ts                  # Zod schemas
│   ├── answer.ts                  # Answer pipeline
│   └── types.ts                   # Shared types
│
├── eval/                          # Evaluation set + harness
├── samples/                       # Sample HR policies
├── data/                          # Generated index
│
├── DESIGN.md                      # Architecture and design decisions
├── .env.example                   # Environment variable template
└── package.json
```

---

## Limitations

This project is intentionally designed for the assignment rather than production-scale deployment.

* Uses an in-memory vector store persisted to JSON; it is not suitable for very large corpora.
* Only `.md` and `.txt` files are currently supported.
* Very large tables may be split across chunks.
* `.txt` section detection is heuristic.
* Refusal of HR-adjacent but absent questions partly depends on the LLM, in addition to the deterministic score gate.
* There is no real authentication; the admin/employee distinction is UI-level only.
* Re-uploading a document replaces its existing chunks.
* Corrupt files that still produce non-empty text may be accepted.

---

## Security

* API keys are stored in `.env`.
* `.env` is git-ignored and must never be committed.
* `.env.example` contains only example configuration.
* Generated vector indexes and model files are git-ignored.
* No API keys or other secrets are included in the repository.

---

## Design Decisions

See [`DESIGN.md`](./DESIGN.md) for:

* System architecture
* Chunking and retrieval strategy
* Grounding and refusal design
* API schemas
* Trade-offs
* Limitations
* What would be hardened with more development time
