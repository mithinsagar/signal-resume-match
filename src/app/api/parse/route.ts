/**
 * POST /api/parse — turn an uploaded document into plain text.
 *
 * Runs server-side rather than in the browser because the PDF and DOCX
 * extractors are heavy and pulling them into the client bundle would cost more
 * than the round trip. Nothing is written to disk or retained after the
 * response: the buffer lives for the duration of the request only.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — well past any real resume.

const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
]);

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * Collapse the whitespace a PDF extractor leaves behind.
 *
 * Column layouts produce runs of spaces and orphaned single-character lines;
 * left alone these break the line-scoped requirement weighting in the analyzer,
 * which reads a posting one line at a time.
 */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

async function extractPdf(buffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { text: Array.isArray(text) ? text.join("\n") : text, pages: totalPages };
}

async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return value;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.` },
        { status: 413 },
      );
    }

    const ext = extensionOf(file.name);
    const typeOk = ACCEPTED.has(file.type) || ["pdf", "docx", "doc", "txt", "md"].includes(ext);
    if (!typeOk) {
      return NextResponse.json(
        { error: "Unsupported format. Upload a PDF, DOCX, TXT or Markdown file." },
        { status: 415 },
      );
    }

    const buffer = await file.arrayBuffer();
    let text = "";
    let pages: number | undefined;

    if (file.type === "application/pdf" || ext === "pdf") {
      const result = await extractPdf(buffer);
      text = result.text;
      pages = result.pages;
    } else if (ext === "docx" || ext === "doc" || file.type.includes("word")) {
      text = await extractDocx(buffer);
    } else {
      text = new TextDecoder().decode(buffer);
    }

    const cleaned = tidy(text);

    if (cleaned.length < 40) {
      return NextResponse.json(
        {
          error:
            "Almost no text came out of that file. If it's a scanned PDF, the text is an image — paste the content instead.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text: cleaned,
      filename: file.name,
      pages,
      chars: cleaned.length,
    });
  } catch (error) {
    console.error("[parse] failed:", error);
    return NextResponse.json(
      { error: "Could not read that file. Try a different export, or paste the text." },
      { status: 500 },
    );
  }
}
