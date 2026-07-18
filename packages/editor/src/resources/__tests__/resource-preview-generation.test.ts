import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { captureElementPreview, generatePdfPreview } from '../resource-preview-generation'

const toBlob = vi.hoisted(() => vi.fn())
const getDocument = vi.hoisted(() => vi.fn())

vi.mock('html-to-image', () => ({ toBlob }))
vi.mock('pdfjs-dist', () => ({
  getDocument,
  GlobalWorkerOptions: { workerSrc: '' },
}))

afterEach(() => {
  vi.restoreAllMocks()
  toBlob.mockReset()
  getDocument.mockReset()
})

describe('resource preview generation', () => {
  it('captures the exact editor element as a readable WebP', async () => {
    const element = document.createElement('div')
    Object.defineProperties(element, {
      clientWidth: { value: 320 },
      clientHeight: { value: 180 },
    })
    const preview = new Blob(['preview'], { type: 'image/webp' })
    toBlob.mockResolvedValue(preview)

    await expect(captureElementPreview(element)).resolves.toBe(preview)
    expect(toBlob).toHaveBeenCalledWith(element, {
      width: 320,
      height: 180,
      pixelRatio: 2,
      quality: 0.9,
      type: 'image/webp',
      skipFonts: true,
    })
  })

  it('renders the first PDF page within the bounded preview frame', async () => {
    const context = {} as CanvasRenderingContext2D
    const preview = new Blob(['pdf preview'], { type: 'image/webp' })
    const canvasToBlob = vi.fn((publish: BlobCallback) => publish(preview))
    const canvas = {
      getContext: vi.fn(() => context),
      height: 0,
      toBlob: canvasToBlob,
      width: 0,
    } as unknown as HTMLCanvasElement
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) =>
      tagName === 'canvas' ? canvas : createElement(tagName, options),
    )
    const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
    const page = {
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 1_200 * scale,
        height: 800 * scale,
      })),
      render,
    }
    const pdf = {
      destroy: vi.fn(() => Promise.resolve()),
      getPage: vi.fn(() => Promise.resolve(page)),
    }
    getDocument.mockReturnValue({
      destroy: vi.fn(() => Promise.resolve()),
      promise: Promise.resolve(pdf),
    })
    const source = new TextEncoder().encode('%PDF-1.7\npreview')

    await expect(generatePdfPreview(source)).resolves.toBe(preview)
    expect(canvas.width).toBe(600)
    expect(canvas.height).toBe(400)
    expect(render).toHaveBeenCalledWith({
      canvas,
      canvasContext: context,
      viewport: { width: 600, height: 400 },
    })
    expect(canvasToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.8)
  })

  it('rejects an already-aborted PDF generation before loading bytes', async () => {
    const abort = new AbortController()
    abort.abort()

    await expect(generatePdfPreview(new Uint8Array([1]), abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(getDocument).not.toHaveBeenCalled()
  })
})
