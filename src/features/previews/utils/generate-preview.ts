import { toBlob } from 'html-to-image'

export async function captureElementPreview(
  element: HTMLElement,
): Promise<Blob> {
  const blob = await toBlob(element, {
    width: element.clientWidth,
    height: element.clientHeight,
    pixelRatio: 2,
    quality: 0.9,
    type: 'image/webp',
    skipFonts: true,
    filter: (node) => {
      if (node instanceof HTMLElement) {
        const cls = node.className
        if (typeof cls === 'string' && cls.includes('react-flow__minimap')) {
          return false
        }
      }
      return true
    },
  })
  if (!blob) throw new Error('Failed to generate preview')
  return blob
}

const PDF_PREVIEW_WIDTH = 600
const PDF_PREVIEW_HEIGHT = 400

export async function generatePdfPreview(
  source: string | ArrayBuffer,
): Promise<Blob> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data =
    source instanceof ArrayBuffer ? { data: new Uint8Array(source) } : source
  const pdf = await pdfjsLib.getDocument(data).promise
  try {
    const page = await pdf.getPage(1)

    const scale = PDF_PREVIEW_WIDTH / page.getViewport({ scale: 1 }).width
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = Math.min(viewport.height, PDF_PREVIEW_HEIGHT)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to generate PDF preview'))
        },
        'image/webp',
        0.8,
      )
    })
  } finally {
    pdf.destroy()
  }
}
