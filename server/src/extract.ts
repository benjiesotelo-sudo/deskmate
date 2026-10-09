import fs from "node:fs";
import path from "node:path";

export const TEXT_EXTENSIONS = [".md", ".txt", ".pdf", ".docx"] as const;

// Turn a filed document into plain text for the document page and for Tams.
// Everything here is pure JavaScript, so nothing needs compiling at install time.
export async function extractText(file: string): Promise<string> {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".md" || ext === ".txt") return fs.readFileSync(file, "utf8");
  if (ext === ".pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
    const { text } = await pdfText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).map((page) => unwrap(tidy(page))).join("\n\n");
  }
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.default.extractRawText({ path: file });
    return tidy(value);
  }
  return "";
}

function tidy(text: string): string {
  return text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// PDF text comes out one printed line at a time. Lines that ran to the right
// margin were wrapped by the layout, so join them back into their paragraph.
function unwrap(text: string): string {
  const lines = text.split("\n");
  const widest = Math.max(0, ...lines.map((l) => l.length));
  const out: string[] = [];
  let joinNext = false;
  for (const line of lines) {
    if (joinNext && line.trim() && out.length) out[out.length - 1] += " " + line.trim();
    else out.push(line);
    joinNext = widest > 40 && line.length >= widest * 0.72;
  }
  return out.join("\n");
}
