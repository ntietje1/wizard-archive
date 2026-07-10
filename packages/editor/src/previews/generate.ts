import { toBlob } from 'html-to-image'
import type * as PdfjsNamespace from 'pdfjs-dist'

export async function captureElementPreview(element: HTMLElement): Promise<Blob> {
  const blob = await toBlob(element, {
    width: element.clientWidth,
    height: element.clientHeight,
    pixelRatio: 2,
    quality: 0.9,
    type: 'image/webp',
    skipFonts: true,
  })
  if (!blob) throw new Error('Failed to generate preview')
  return blob
}

const PDF_PREVIEW_WIDTH = 600
const PDF_PREVIEW_HEIGHT = 400

let pdfInitPromise: Promise<typeof PdfjsNamespace> | null = null

type PdfPreviewOptions = {
  signal?: AbortSignal
}

function initPdfWorker() {
  if (!pdfInitPromise) {
    pdfInitPromise = import('pdfjs-dist')
      .then((pdfjsLib) => {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        return pdfjsLib
      })
      .catch((error) => {
        pdfInitPromise = null
        throw error
      })
  }
  return pdfInitPromise
}

function createAbortError(signal: AbortSignal) {
  if (signal.reason) return signal.reason
  return new DOMException('PDF preview generation aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError(signal)
}

function blobFromCanvas(canvas: HTMLCanvasElement, signal?: AbortSignal) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        try {
          throwIfAborted(signal)
        } catch (error) {
          reject(error)
          return
        }
        if (blob) resolve(blob)
        else reject(new Error('Failed to generate PDF preview'))
      },
      'image/webp',
      0.8,
    )
  })
}

export async function generatePdfPreview(
  source: string | ArrayBuffer,
  options: PdfPreviewOptions = {},
): Promise<Blob> {
  const pdfjsLib = await initPdfWorker()

  throwIfAborted(options.signal)
  const data = source instanceof ArrayBuffer ? { data: new Uint8Array(source) } : source
  const loadingTask = pdfjsLib.getDocument(data)
  const abortLoading = () => {
    void loadingTask.destroy()
  }
  options.signal?.addEventListener('abort', abortLoading, { once: true })

  let pdf: PdfjsNamespace.PDFDocumentProxy | null = null
  try {
    pdf = await loadingTask.promise
    throwIfAborted(options.signal)
    const page = await pdf.getPage(1)
    throwIfAborted(options.signal)

    const pageSize = page.getViewport({ scale: 1 })
    const scale = Math.min(PDF_PREVIEW_WIDTH / pageSize.width, PDF_PREVIEW_HEIGHT / pageSize.height)
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    const renderTask = page.render({ canvasContext: ctx, viewport, canvas })
    const abortRender = () => renderTask.cancel()
    options.signal?.addEventListener('abort', abortRender, { once: true })
    try {
      throwIfAborted(options.signal)
      await renderTask.promise
      throwIfAborted(options.signal)
    } finally {
      options.signal?.removeEventListener('abort', abortRender)
    }

    return blobFromCanvas(canvas, options.signal)
  } finally {
    options.signal?.removeEventListener('abort', abortLoading)
    if (pdf) void pdf.destroy()
  }
}
