/**
 * Client-side OCR fallback for scanned PDFs.
 *
 * Deliberately browser-only, never server-side. `unpdf`'s page rasterizer
 * (`renderPageAsImage`) needs a canvas; in Node that means the native `canvas`
 * package, which is a real risk on Vercel's serverless build image (prebuilt
 * binary mismatches, cold-start compile failures). In a browser there is no
 * native dependency at all — `document.createElement("canvas")` is built in —
 * and there's no function-timeout ceiling, because the work runs on the user's
 * own machine for as long as it takes, with visible progress instead of a
 * silent 30-second cutoff.
 *
 * This module must only ever be imported dynamically from client components
 * (`await import("@/lib/ocr")`), never from a server route — importing
 * `tesseract.js` eagerly would pull its worker/WASM plumbing into every bundle
 * that touches this file.
 */

export interface OcrProgress {
  page: number;
  pages: number;
  /** 0-1 recognition progress within the current page. */
  status: string;
  progress: number;
}

/**
 * Rasterize every page of a PDF and OCR each one, concatenating the result.
 *
 * Runs pages sequentially on a single tesseract worker rather than in
 * parallel — a multi-page scan already takes real wall-clock time, and
 * spinning up several WASM workers at once on a laptop tends to make all of
 * them slower, not the total faster.
 */
export async function ocrPdf(file: File, onProgress?: (p: OcrProgress) => void): Promise<string> {
  const [{ getDocumentProxy, renderPageAsImage }, { createWorker, OEM }] = await Promise.all([
    import("unpdf"),
    import("tesseract.js"),
  ]);

  const buffer = await file.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages = pdf.numPages;

  // Declared before `createWorker` — its internal message handler can invoke
  // the logger the moment the worker script loads, well before this
  // function's own `await` resolves, so `current` must already exist rather
  // than sit in the temporal dead zone of a `let` declared afterward.
  let current = 1;

  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    logger: (m: { status: string; progress: number }) => {
      onProgress?.({ page: current, pages, status: m.status, progress: m.progress });
    },
  });

  try {
    const pieces: string[] = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      current = pageNumber;
      onProgress?.({ page: pageNumber, pages, status: "rendering page", progress: 0 });

      // No `canvas` option passed — that's what selects the browser-native
      // `HTMLCanvasElement` path in unpdf's isomorphic canvas factory instead
      // of trying to load Node's `canvas` package.
      const image = await renderPageAsImage(pdf, pageNumber, { scale: 2 });

      const {
        data: { text },
      } = await worker.recognize(new Blob([image], { type: "image/png" }));
      pieces.push(text);
    }
    return pieces.join("\n\n");
  } finally {
    await worker.terminate();
  }
}
