import fs from "fs";
import path from "path";

const BASE = process.env.EVAL_BASE_URL ?? "http://localhost:3000";

interface Expect {
  refused?: boolean;
  error?: boolean;
  answerIncludes?: string[];
  citationSectionIncludes?: string[];
}
interface Case {
  id: string; category: string; question: string; expect: Expect;
}

const cases: Case[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "eval-set.json"), "utf-8")
);

async function runCase(c: Case) {
  const res = await fetch(`${BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: c.question }),
  });

  const failures: string[] = [];

  // Empty/invalid questions should be rejected with a 4xx error.
  if (c.expect.error) {
    if (res.ok) failures.push(`expected an error status, got ${res.status}`);
    return report(c, failures);
  }

  const data = await res.json();

  if (c.expect.refused !== undefined && data.refused !== c.expect.refused) {
    failures.push(`refused=${data.refused}, expected ${c.expect.refused}`);
  }

  const answer = (data.answer ?? "").toLowerCase();
  for (const needle of c.expect.answerIncludes ?? []) {
    if (!answer.includes(needle.toLowerCase())) {
      failures.push(`answer missing "${needle}"`);
    }
  }

  const sections = (data.citations ?? [])
    .map((x: any) => (x.section ?? "").toLowerCase())
    .join(" | ");
  for (const needle of c.expect.citationSectionIncludes ?? []) {
    if (!sections.includes(needle.toLowerCase())) {
      failures.push(`no citation section matching "${needle}" (got: ${sections || "none"})`);
    }
  }

  return report(c, failures);
}

function report(c: Case, failures: string[]) {
  const ok = failures.length === 0;
  console.log(`${ok ? "PASS" : "FAIL"}  [${c.category}] ${c.id}`);
  if (!ok) failures.forEach((f) => console.log(`     - ${f}`));
  return ok;
}

(async () => {
  console.log(`Running ${cases.length} eval cases against ${BASE}\n`);
  let passed = 0;
  for (const c of cases) {
    try {
      if (await runCase(c)) passed++;
    } catch (e) {
      console.log(`FAIL  [${c.category}] ${c.id}\n     - threw: ${e}`);
    }
  }
  console.log(`\n${passed}/${cases.length} passed.`);
  process.exit(passed === cases.length ? 0 : 1);
})();
