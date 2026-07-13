import { describe, expect, it, vi } from 'vite-plus/test'
import { MAX_PDF_PREVIEW_SIZE, runPdfPreviewGeneration } from '../../files/pdf-preview-generation'
import type { SidebarItemId } from '../../../../../shared/common/ids'

const fileId = 'file-id' as SidebarItemId

function pdfFile(name = 'file.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

describe('runPdfPreviewGeneration', () => {
  it('returns unsupported for non-PDF files', async () => {
    const result = await runPdfPreviewGeneration({
      file: new File(['text'], 'file.txt', { type: 'text/plain' }),
      fileId,
      claimAndUpload: vi.fn(),
    })

    expect(result).toEqual({ status: 'unsupported' })
  })

  it('skips PDFs over the preview size limit', async () => {
    const file = pdfFile()
    Object.defineProperty(file, 'size', { value: MAX_PDF_PREVIEW_SIZE + 1 })
    const result = await runPdfPreviewGeneration({ file, fileId, claimAndUpload: vi.fn() })

    expect(result).toEqual({
      status: 'skipped-too-large',
      size: MAX_PDF_PREVIEW_SIZE + 1,
      maxSize: MAX_PDF_PREVIEW_SIZE,
    })
  })

  it('publishes a generated PDF preview through the claim/upload boundary', async () => {
    const previewBlob = new Blob(['preview'], { type: 'image/webp' })
    const renderPdfPreview = vi.fn().mockResolvedValue(previewBlob)
    const claimAndUpload = vi.fn(async (_itemId, generate: () => Promise<Blob>) => {
      expect(await generate()).toBe(previewBlob)
      return { status: 'success' as const }
    })

    const result = await runPdfPreviewGeneration({
      file: pdfFile(),
      fileId,
      claimAndUpload,
      renderPdfPreview,
    })

    expect(result).toEqual({ status: 'published' })
    expect(claimAndUpload).toHaveBeenCalledWith(fileId, expect.any(Function), {
      signal: undefined,
    })
    expect(renderPdfPreview).toHaveBeenCalledOnce()
  })

  it('passes preview cancellation state through render and upload boundaries', async () => {
    const controller = new AbortController()
    const previewBlob = new Blob(['preview'], { type: 'image/webp' })
    const renderPdfPreview = vi.fn().mockResolvedValue(previewBlob)
    const claimAndUpload = vi.fn(async (_itemId, generate: () => Promise<Blob>) => {
      expect(await generate()).toBe(previewBlob)
      return { status: 'success' as const }
    })

    const result = await runPdfPreviewGeneration({
      file: pdfFile(),
      fileId,
      claimAndUpload,
      renderPdfPreview,
      options: { signal: controller.signal },
    })

    expect(result).toEqual({ status: 'published' })
    expect(claimAndUpload).toHaveBeenCalledWith(fileId, expect.any(Function), {
      signal: controller.signal,
    })
    expect(renderPdfPreview).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      signal: controller.signal,
    })
  })

  it('treats .pdf filenames as PDFs when MIME type is empty', async () => {
    const claimAndUpload = vi.fn().mockResolvedValue({ status: 'success' })

    const result = await runPdfPreviewGeneration({
      file: new File(['%PDF-1.4'], 'file.pdf', { type: '' }),
      fileId,
      claimAndUpload,
      renderPdfPreview: vi.fn().mockResolvedValue(new Blob(['preview'])),
    })

    expect(result).toEqual({ status: 'published' })
    expect(claimAndUpload).toHaveBeenCalledOnce()
  })

  it('returns not-claimed when preview generation cannot claim the item', async () => {
    const claimAndUpload = vi.fn().mockResolvedValue({ status: 'not-claimed' })
    const file = pdfFile()
    const renderPdfPreview = vi.fn()

    const result = await runPdfPreviewGeneration({
      file,
      fileId,
      claimAndUpload,
      renderPdfPreview,
    })

    expect(result).toEqual({ status: 'not-claimed' })
  })

  it('returns stale when preview generation loses its upload claim', async () => {
    const claimAndUpload = vi.fn().mockResolvedValue({ status: 'stale' })
    const renderPdfPreview = vi.fn()

    const result = await runPdfPreviewGeneration({
      file: pdfFile(),
      fileId,
      claimAndUpload,
      renderPdfPreview,
    })

    expect(result).toEqual({ status: 'stale' })
  })

  it('returns failed when claim/upload reports an error', async () => {
    const error = new Error('upload failed')
    const claimAndUpload = vi.fn().mockResolvedValue({ status: 'error', error })

    const result = await runPdfPreviewGeneration({
      file: pdfFile(),
      fileId,
      claimAndUpload,
      renderPdfPreview: vi.fn(),
    })

    expect(result).toEqual({ status: 'failed', error })
  })

  it('returns failed when the file cannot be read', async () => {
    const error = new Error('read failed')
    const file = pdfFile()
    Object.defineProperty(file, 'arrayBuffer', { value: vi.fn().mockRejectedValue(error) })

    const result = await runPdfPreviewGeneration({
      file,
      fileId,
      claimAndUpload: vi.fn(async (_itemId, generate: () => Promise<Blob>) => {
        await generate()
        return { status: 'success' as const }
      }),
      renderPdfPreview: vi.fn(),
    })

    expect(result).toEqual({ status: 'failed', error })
  })
})
