"use client";

/**
 * One side of the workbench.
 *
 * Both inputs accept typed or pasted text; the resume side additionally accepts
 * a file, which is sent to /api/parse and comes back as text the user can still
 * see and edit. Showing the extracted text rather than hiding it behind a
 * filename chip is deliberate — PDF extraction is lossy often enough that the
 * user needs to be able to notice when it has mangled something.
 */

import { useCallback, useRef, useState } from "react";
import type { ParsedDocument } from "@/lib/types";
import type { OcrProgress } from "@/lib/ocr";

interface Props {
  accent: "violet" | "cyan";
  eyebrow: string;
  title: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  allowUpload?: boolean;
  onLoadSample?: () => void;
  sampleLabel?: string;
}

const ACCENT = {
  violet: { color: "var(--color-violet)", soft: "var(--color-violet-soft)" },
  cyan: { color: "var(--color-cyan)", soft: "var(--color-cyan-soft)" },
};

export default function InputPanel({
  accent,
  eyebrow,
  title,
  placeholder,
  value,
  onChange,
  allowUpload = false,
  onLoadSample,
  sampleLabel = "Load a sample",
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ParsedDocument | null>(null);
  // Kept only so a failed upload can offer OCR on the exact same bytes
  // without asking the user to pick the file again.
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tone = ACCENT[accent];
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  const handleFile = useCallback(
    async (file: File) => {
      setParsing(true);
      setError(null);
      setScannedFile(null);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/parse", { method: "POST", body });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Could not read that file.");
          if (data.scanned) setScannedFile(file);
          return;
        }
        onChange(data.text);
        setSource(data as ParsedDocument);
      } catch {
        setError("Upload failed. Check your connection and try again.");
      } finally {
        setParsing(false);
      }
    },
    [onChange],
  );

  const handleOcr = useCallback(
    async (file: File) => {
      setParsing(true);
      setError(null);
      setOcrProgress(null);
      try {
        // Dynamic import: tesseract.js's worker/WASM plumbing has no reason
        // to be in the initial bundle when most uploads never need it.
        const { ocrPdf } = await import("@/lib/ocr");
        const text = await ocrPdf(file, setOcrProgress);
        const cleaned = text.trim();
        if (cleaned.length < 40) {
          setError("OCR couldn't find readable text in that scan either. Try pasting the content instead.");
          return;
        }
        onChange(cleaned);
        setSource({ text: cleaned, filename: file.name, chars: cleaned.length });
        setScannedFile(null);
      } catch {
        setError("OCR failed partway through. Try again, or paste the content instead.");
      } finally {
        setParsing(false);
        setOcrProgress(null);
      }
    },
    [onChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      className="panel bevel flex h-full flex-col p-5 transition-colors duration-300 sm:p-6"
      style={dragging ? { borderColor: tone.color } : undefined}
      onDragOver={(e) => {
        if (!allowUpload) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={allowUpload ? onDrop : undefined}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mono-label mb-1.5 flex items-center gap-2">
            <span className="size-1.5 rounded-full" style={{ background: tone.color }} />
            {eyebrow}
          </div>
          <h2 className="display text-2xl text-ink">{title}</h2>
        </div>

        {onLoadSample && (
          <button
            type="button"
            onClick={onLoadSample}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
          >
            {sampleLabel}
          </button>
        )}
      </div>

      {allowUpload && (
        <div className="mb-3">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,application/pdf,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
            className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-line px-4 py-3 text-left transition-all duration-200 hover:border-line-bright disabled:opacity-60"
            style={dragging ? { borderColor: tone.color, background: `color-mix(in oklab, ${tone.color} 7%, transparent)` } : undefined}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-line transition-colors"
              style={{ color: tone.color }}
            >
              {parsing ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">
                {ocrProgress
                  ? `OCR — page ${ocrProgress.page} of ${ocrProgress.pages}`
                  : parsing
                    ? "Reading document…"
                    : dragging
                      ? "Drop it"
                      : "Drop a PDF, DOCX or TXT"}
              </span>
              <span className="block truncate text-xs text-ink-faint">
                {ocrProgress
                  ? `${ocrProgress.status} · ${Math.round(ocrProgress.progress * 100)}%`
                  : source
                    ? `${source.filename}${source.pages ? ` · ${source.pages} page${source.pages === 1 ? "" : "s"}` : ""} · ${source.chars.toLocaleString()} chars`
                    : "or click to browse — the text stays editable"}
              </span>
            </span>
          </button>

          {error && (
            <div className="mt-2 rounded-lg border border-rose/30 bg-rose/5 px-3 py-2 text-xs leading-relaxed text-rose">
              <p>{error}</p>
              {scannedFile && (
                <button
                  type="button"
                  onClick={() => void handleOcr(scannedFile)}
                  disabled={parsing}
                  className="mt-1.5 rounded-md border border-rose/40 px-2 py-1 text-[0.7rem] font-medium text-rose transition-colors hover:bg-rose/10 disabled:opacity-60"
                >
                  Try in-browser OCR instead — runs on your machine, may take a minute
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="h-full min-h-52 w-full resize-none rounded-xl border border-line bg-void/50 p-4 font-mono text-[13px] leading-relaxed text-ink-dim transition-colors focus:text-ink"
        />
      </div>

      <div className="mono-label mt-3 flex items-center justify-between">
        <span>{words.toLocaleString()} words</span>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSource(null);
              setError(null);
            }}
            className="transition-colors hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
