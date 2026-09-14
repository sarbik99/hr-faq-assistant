import { ParsedDocument, ParsedSection, IngestionError } from "./types";

const SUPPORTED_EXTENSIONS = [".md", ".txt"] as const;

/**
 * Entry point: raw file content + name -> structured ParsedDocument.
 * Throws IngestionError (never crashes) on bad input.
 */
export function parseDocument(fileName: string, rawContent: string): ParsedDocument {
  // VALIDATE extension.
  const ext = getExtension(fileName);
  if (!SUPPORTED_EXTENSIONS.includes(ext as any)) {
    throw new IngestionError(
      `Unsupported file type "${ext}". Only .md and .txt are supported.`,
      "UNSUPPORTED_FORMAT"
    );
  }

  // VALIDATE non-empty (after trimming whitespace/BOM).
  const content = stripBom(rawContent).trim();
  if (content.length === 0) {
    throw new IngestionError("File is empty.", "EMPTY_FILE");
  }

  // PARSE into sections based on type.
  const sections =
    ext === ".md" ? splitMarkdownSections(content) : splitTextSections(content);

  // Safety net: if nothing usable came out, treat as unreadable.
  if (sections.length === 0) {
    throw new IngestionError("No readable text found in file.", "UNREADABLE_FILE");
  }

  return { documentName: fileName, sections };
}

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

// Remove a UTF-8 byte-order-mark if present
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/**
 * MARKDOWN: split on heading lines (#, ##, ###...).
 * Each heading starts a new section; text before the first heading
 * is kept under an "Introduction" section so no content is lost.
 */
function splitMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split(/\r?\n/);
  const sections: ParsedSection[] = [];

  let currentHeading = "";
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (text.length > 0) {
      sections.push({ section: currentHeading || "Introduction", text });
    }
    buffer = [];
  };

  const headingRe = /^(#{1,6})\s+(.*)$/;
  for (const line of lines) {
    const m = line.match(headingRe);
    if (m) {
      flush();                       // close the previous section
      currentHeading = m[2].trim();  // capture new heading text (without #)
    } else {
      buffer.push(line);
    }
  }
  flush(); // close the final section

  return sections;
}

/**
 * PLAIN TEXT: no formal headings. Heuristic:
 *  - split into blank-line-separated blocks (paragraphs);
 *  - a short single line (no ending period) is treated as a heading
 *    for the block(s) that follow;
 *  - otherwise everything falls under a "Document" section.
 */
function splitTextSections(content: string): ParsedSection[] {
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const sections: ParsedSection[] = [];

  let currentHeading = "Document";
  for (const block of blocks) {
    if (looksLikeHeading(block)) {
      currentHeading = block.replace(/[:\s]+$/, ""); // strip trailing colon
    } else {
      sections.push({ section: currentHeading, text: block });
    }
  }

  // If the whole file was one blob with no detectable headings,
  // still return it as a single section.
  if (sections.length === 0) {
    sections.push({ section: "Document", text: content });
  }
  return sections;
}

function looksLikeHeading(block: string): boolean {
  const isSingleLine = !block.includes("\n");
  const isShort = block.length <= 60;
  const noSentencePunct = !/[.!?]$/.test(block);
  return isSingleLine && isShort && noSentencePunct;
}
