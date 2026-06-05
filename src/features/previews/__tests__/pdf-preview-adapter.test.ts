import { describe, expect, it, vi } from 'vitest'
import { runPdfPreviewGeneration } from '../pdf-preview-adapter'
import { testId } from '~/test/helpers/test-id'

const fileId = testId<'sidebarItems'>('file-id')
const maxPdfPreviewSize = 50 * 1024 * 1024

function pdfFile(name = 'file.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

describe('runPdfPreviewGeneration', () => {
  it('returns unsupported for non-PDF files', async () => {
    const claimAndUpload = vi.fn()

    const result = await runPdfPreviewGeneration({
      file: new File(['text'], 'file.txt', { type: 'text/plain' }),
      fileId,
      claimAndUpload,
    })

    expect(result).toEqual({ status: 'unsupported' })
    expect(claimAndUpload).not.toHaveBeenCalled()
  })

  it('skips PDFs over the preview size limit', async () => {
    const file = pdfFile()
    Object.defineProperty(file, 'size', { value: maxPdfPreviewSize + 1 })
    const claimAndUpload = vi.fn()

    const result = await runPdfPreviewGeneration({ file, fileId, claimAndUpload })

    expect(result).toEqual({
      status: 'skipped-too-large',
      size: maxPdfPreviewSize + 1,
      maxSize: maxPdfPreviewSize,
    })
    expect(claimAndUpload).not.toHaveBeenCalled()
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
    const arrayBuffer = vi.fn()
    Object.defineProperty(file, 'arrayBuffer', { value: arrayBuffer })
    const renderPdfPreview = vi.fn()

    const result = await runPdfPreviewGeneration({
      file,
      fileId,
      claimAndUpload,
      renderPdfPreview,
    })

    expect(result).toEqual({ status: 'not-claimed' })
    expect(arrayBuffer).not.toHaveBeenCalled()
    expect(renderPdfPreview).not.toHaveBeenCalled()
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
