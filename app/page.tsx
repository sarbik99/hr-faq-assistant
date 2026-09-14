"use client";

import { useState } from "react";

interface Citation {
  document: string;
  section: string;
}

interface QueryResponse {
  answer: string;
  citations: Citation[];
  refused: boolean;
}

export default function Home() {
  // --- upload state ---
  const [file, setFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // --- query state ---
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [queryErr, setQueryErr] = useState<string>("");
  const [asking, setAsking] = useState(false);

  async function handleUpload() {
    if (!file) {
      setUploadMsg("Please choose a file first.");
      return;
    }

    setUploading(true);
    setUploadMsg("");

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      setUploadMsg(res.ok ? `${data.message}` : `${data.error}`);
    } catch {
      setUploadMsg("Upload failed (network error).");
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk() {
    const q = question.trim();

    if (!q) {
      setQueryErr("Please enter a question.");
      return;
    }

    setAsking(true);
    setQueryErr("");
    setResponse(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();

      if (!res.ok) {
        setQueryErr(data.error ?? "Query failed.");
      } else {
        setResponse(data as QueryResponse);
      }
    } catch {
      setQueryErr("Query failed (network error).");
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-5 py-10">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            HR FAQ & Policy Assistant
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Ask questions about uploaded HR policies.
          </p>
        </header>

        <div className="space-y-6">
          {/* Admin upload */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Upload Policy
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Upload a Markdown or text file to add it to the policy
                knowledge base.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept=".md,.txt"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setUploadMsg("");
                }}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 sm:flex-1"
              />

              <button
                onClick={handleUpload}
                disabled={uploading}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>

            {file && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: {file.name}
              </p>
            )}

            {uploadMsg && (
              <p className="mt-3 text-sm text-gray-600">{uploadMsg}</p>
            )}
          </section>

          {/* Employee question */}
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-gray-900">
                Ask a Question
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                The assistant answers using the uploaded policies.
              </p>
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the casual leave carry-forward limit?"
              rows={4}
              className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />

            <div className="mt-3 flex justify-end">
              <button
                onClick={handleAsk}
                disabled={asking}
                className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {asking ? "Thinking..." : "Ask"}
              </button>
            </div>

            {queryErr && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {queryErr}
              </div>
            )}

            {response && (
              <div className="mt-6 border-t border-gray-200 pt-5">
                <div
                  className={`rounded-md border p-4 ${
                    response.refused
                      ? "border-amber-200 bg-amber-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <h3 className="text-sm font-semibold text-gray-900">
                    {response.refused ? "No answer found" : "Answer"}
                  </h3>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                    {response.answer}
                  </p>
                </div>

                {response.citations.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Citations
                    </h3>

                    <div className="mt-2 divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
                      {response.citations.map((citation, index) => (
                        <div
                          key={index}
                          className="px-3 py-2.5 text-sm"
                        >
                          <p className="font-medium text-gray-800">
                            {citation.document}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {citation.section}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 text-center text-xs text-gray-400">
          Answers are based only on uploaded HR policies.
        </footer>
      </div>
    </main>
  );
}