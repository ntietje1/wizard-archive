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

function loadPdfjs() {
  if (!pdfInitPromise) {
    pdfInitPromise = import('pdfjs-dist')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        return pdfjs
      })
      .catch((error) => {
        pdfInitPromise = null
        throw error
      })
  }
  return pdfInitPromise
}

export async function generatePdfPreview(source: Uint8Array, signal?: AbortSignal): Promise<Blob> {
  throwIfAborted(signal)
  const pdfjs = await loadPdfjs()
  throwIfAborted(signal)
  const loading = pdfjs.getDocument({ data: Uint8Array.from(source) })
  const abortLoading = () => {
    void loading.destroy().catch(() => undefined)
  }
  signal?.addEventListener('abort', abortLoading, { once: true })

  let pdf: PdfjsNamespace.PDFDocumentProxy | null = null
  try {
    pdf = await loading.promise
    throwIfAborted(signal)
    const page = await pdf.getPage(1)
    throwIfAborted(signal)
    const natural = page.getViewport({ scale: 1 })
    const scale = Math.min(PDF_PREVIEW_WIDTH / natural.width, PDF_PREVIEW_HEIGHT / natural.height)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Failed to get canvas context')

    const rendering = page.render({ canvas, canvasContext: context, viewport })
    const abortRendering = () => rendering.cancel()
    signal?.addEventListener('abort', abortRendering, { once: true })
    try {
      await rendering.promise
      throwIfAborted(signal)
    } finally {
      signal?.removeEventListener('abort', abortRendering)
    }
    return await canvasPreviewBlob(canvas, signal)
  } finally {
    signal?.removeEventListener('abort', abortLoading)
    if (pdf) void pdf.destroy().catch(() => undefined)
  }
}

function canvasPreviewBlob(canvas: HTMLCanvasElement, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        try {
          throwIfAborted(signal)
          if (!blob) throw new Error('Failed to generate PDF preview')
          resolve(blob)
        } catch (error) {
          reject(error)
        }
      },
      'image/webp',
      0.8,
    )
  })
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  throw signal.reason ?? new DOMException('Preview generation aborted', 'AbortError')
}
