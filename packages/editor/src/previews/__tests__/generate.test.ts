import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type * as GenerateModule from '../generate'

const htmlToImage = vi.hoisted(() => ({
  toBlob: vi.fn(),
}))

const pdfjs = vi.hoisted(() => ({
  GlobalWorkerOptions: {} as { workerSrc?: string },
  getDocument: vi.fn(),
}))

vi.mock('html-to-image', () => htmlToImage)

vi.mock('pdfjs-dist', () => pdfjs)

async function loadGenerateModule(): Promise<typeof GenerateModule> {
  return import('../generate')
}

function setupCanvasPreview(blob: Blob | null = new Blob(['preview'], { type: 'image/webp' })) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function toBlob(callback) {
    callback(blob)
  })
}

function createPdfDocument() {
  const renderTask = {
    cancel: vi.fn(),
    promise: Promise.resolve(),
  }
  const page = {
    getViewport: vi.fn(({ scale }: { scale: number }) => ({
      height: 200 * scale,
      width: 300 * scale,
    })),
    render: vi.fn(() => renderTask),
  }
  const pdf = {
    destroy: vi.fn(),
    getPage: vi.fn().mockResolvedValue(page),
  }
  const loadingTask = {
    destroy: vi.fn(),
    promise: Promise.resolve(pdf),
  }
  pdfjs.getDocument.mockReturnValue(loadingTask)
  return { loadingTask, page, pdf, renderTask }
}

describe('generatePdfPreview', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    Object.defineProperty(pdfjs.GlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      value: undefined,
      writable: true,
    })
    pdfjs.getDocument.mockReset()
    vi.doMock('pdfjs-dist', () => pdfjs)
    vi.doMock('html-to-image', () => htmlToImage)
    htmlToImage.toBlob.mockReset()
    setupCanvasPreview()
  })

  it('generates a webp blob from the first PDF page', async () => {
    const { generatePdfPreview } = await loadGenerateModule()
    const { loadingTask, page, pdf, renderTask } = createPdfDocument()

    const blob = await generatePdfPreview(new ArrayBuffer(1))

    expect(blob.type).toBe('image/webp')
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain('pdf.worker.min.mjs')
    expect(pdfjs.getDocument).toHaveBeenCalledExactlyOnceWith({ data: expect.any(Uint8Array) })
    expect(pdf.getPage).toHaveBeenCalledExactlyOnceWith(1)
    expect(page.render).toHaveBeenCalledExactlyOnceWith({
      canvas: expect.any(HTMLCanvasElement),
      canvasContext: expect.any(Object),
      viewport: { height: 400, width: 600 },
    })
    expect(renderTask.cancel).not.toHaveBeenCalled()
    expect(loadingTask.destroy).not.toHaveBeenCalled()
    expect(pdf.destroy).toHaveBeenCalledOnce()
  })

  it('rejects already aborted PDF preview generation', async () => {
    const { generatePdfPreview } = await loadGenerateModule()
    const controller = new AbortController()
    controller.abort()

    await expect(
      generatePdfPreview(new ArrayBuffer(1), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('clears failed PDF worker initialization so the next call can retry', async () => {
    const initError = new Error('pdf worker init failed')
    let workerSrc: string | undefined
    let attempts = 0
    Object.defineProperty(pdfjs.GlobalWorkerOptions, 'workerSrc', {
      configurable: true,
      get: () => workerSrc,
      set: (value: string | undefined) => {
        attempts += 1
        if (attempts === 1) throw initError
        workerSrc = value
      },
    })
    const { generatePdfPreview } = await loadGenerateModule()

    await expect(generatePdfPreview(new ArrayBuffer(1))).rejects.toBe(initError)

    createPdfDocument()
    await expect(generatePdfPreview(new ArrayBuffer(1))).resolves.toBeInstanceOf(Blob)
    expect(attempts).toBe(2)
  })

  it('destroys PDF loading when the signal aborts during loading', async () => {
    const { generatePdfPreview } = await loadGenerateModule()
    const controller = new AbortController()
    let rejectLoading!: (error: DOMException) => void
    const loadingTask = {
      destroy: vi.fn(),
      promise: new Promise((_resolve, reject) => {
        rejectLoading = reject
      }),
    }
    pdfjs.getDocument.mockReturnValue(loadingTask)

    const preview = generatePdfPreview(new ArrayBuffer(1), { signal: controller.signal })
    await vi.waitFor(() => expect(pdfjs.getDocument).toHaveBeenCalledOnce())

    controller.abort()
    rejectLoading(new DOMException('loading cancelled', 'AbortError'))

    await expect(preview).rejects.toMatchObject({ name: 'AbortError' })
    expect(loadingTask.destroy).toHaveBeenCalledOnce()
  })

  it('cancels PDF rendering when the signal aborts during rendering', async () => {
    const { generatePdfPreview } = await loadGenerateModule()
    const controller = new AbortController()
    const renderError = Object.assign(new Error('render cancelled'), {
      name: 'RenderingCancelledException',
    })
    let rejectRender!: (error: Error & { name: string }) => void
    const renderTask = {
      cancel: vi.fn(() => rejectRender(renderError)),
      promise: new Promise<void>((_resolve, reject) => {
        rejectRender = reject
      }),
    }
    const page = {
      getViewport: vi.fn(() => ({ width: 300, height: 200 })),
      render: vi.fn(() => renderTask),
    }
    const pdf = {
      destroy: vi.fn(),
      getPage: vi.fn().mockResolvedValue(page),
    }
    pdfjs.getDocument.mockReturnValue({
      destroy: vi.fn(),
      promise: Promise.resolve(pdf),
    })

    const preview = generatePdfPreview(new ArrayBuffer(1), { signal: controller.signal })
    await vi.waitFor(() => expect(page.render).toHaveBeenCalledOnce())
    controller.abort()

    await expect(preview).rejects.toMatchObject({ name: 'RenderingCancelledException' })
    expect(renderTask.cancel).toHaveBeenCalledOnce()
  })
})

describe('captureElementPreview', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.doMock('html-to-image', () => htmlToImage)
    htmlToImage.toBlob.mockReset()
  })

  it('captures an element preview as a webp blob', async () => {
    const { captureElementPreview } = await loadGenerateModule()
    const blob = new Blob(['element'], { type: 'image/webp' })
    const element = document.createElement('section')
    Object.defineProperty(element, 'clientWidth', { value: 320 })
    Object.defineProperty(element, 'clientHeight', { value: 180 })
    htmlToImage.toBlob.mockResolvedValue(blob)

    await expect(captureElementPreview(element)).resolves.toBe(blob)
    expect(htmlToImage.toBlob).toHaveBeenCalledExactlyOnceWith(element, {
      height: 180,
      pixelRatio: 2,
      quality: 0.9,
      skipFonts: true,
      type: 'image/webp',
      width: 320,
    })
  })

  it('throws when element preview capture does not return a blob', async () => {
    const { captureElementPreview } = await loadGenerateModule()
    htmlToImage.toBlob.mockResolvedValue(null)

    await expect(captureElementPreview(document.createElement('section'))).rejects.toThrow(
      'Failed to generate preview',
    )
  })
})
