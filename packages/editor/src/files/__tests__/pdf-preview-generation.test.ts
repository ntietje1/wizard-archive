import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it, vi } from 'vite-plus/test'
import { runPdfPreviewGeneration } from '../pdf-preview-generation'
import type { PreviewUpload } from '../preview-upload-contract'

const OVERSIZED_PDF_BYTES = 50 * 1024 * 1024 + 1
const fileId = 'file-1' as ResourceId
type PreviewUploadResult = Awaited<ReturnType<PreviewUpload>>

describe('runPdfPreviewGeneration', () => {
  it('accepts the File MIME type when content metadata conflicts', async () => {
    const renderPdfPreview = vi.fn(() => Promise.resolve(new Blob()))

    await runPdfPreviewGeneration({
      file: createPreviewFile({
        name: 'handout.bin',
        contentType: 'application/octet-stream',
        type: 'application/pdf',
      }),
      fileId,
      claimAndUpload: vi.fn<PreviewUpload>(async (_itemId, generate) => {
        await generate()
        return { status: 'success' }
      }),
      renderPdfPreview,
    })

    expect(renderPdfPreview).toHaveBeenCalledOnce()
  })
  it('skips unsupported files before claiming preview upload work', async () => {
    const claimAndUpload = vi.fn<PreviewUpload>()

    await expect(
      runPdfPreviewGeneration({
        file: createPreviewFile({ name: 'notes.txt', contentType: 'text/plain' }),
        fileId,
        claimAndUpload,
      }),
    ).resolves.toEqual({ status: 'unsupported' })
    expect(claimAndUpload).not.toHaveBeenCalled()
  })

  it('skips oversized PDF files before reading file content', async () => {
    const file = createPreviewFile({
      name: 'huge.pdf',
      contentType: 'application/pdf',
      size: OVERSIZED_PDF_BYTES,
    })

    await expect(
      runPdfPreviewGeneration({
        file,
        fileId,
        claimAndUpload: vi.fn<PreviewUpload>(),
      }),
    ).resolves.toEqual({
      status: 'skipped-too-large',
      size: file.size,
      maxSize: OVERSIZED_PDF_BYTES - 1,
    })
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })

  it('publishes rendered PDF previews through the claimed upload', async () => {
    const signal = new AbortController().signal
    const preview = new Blob(['preview'], { type: 'image/png' })
    const renderPdfPreview = vi.fn(() => Promise.resolve(preview))
    const claimAndUpload = vi.fn<PreviewUpload>(async (_itemId, generate, options) => {
      expect(options).toEqual({ signal })
      await expect(generate()).resolves.toBe(preview)
      return { status: 'success' }
    })

    await expect(
      runPdfPreviewGeneration({
        file: createPreviewFile({ name: 'handout.pdf', contentType: 'application/pdf' }),
        fileId,
        claimAndUpload,
        renderPdfPreview,
        options: { signal },
      }),
    ).resolves.toEqual({ status: 'published' })
    expect(claimAndUpload).toHaveBeenCalledWith(fileId, expect.any(Function), { signal })
    expect(renderPdfPreview).toHaveBeenCalledWith(expect.any(ArrayBuffer), { signal })
  })

  it.each([
    ['not-claimed', { status: 'not-claimed' }],
    ['stale', { status: 'stale' }],
    ['error', { status: 'error', error: new Error('upload failed') }],
  ] satisfies Array<[string, PreviewUploadResult]>)(
    'maps %s upload results to preview generation results',
    async (_label, uploadResult) => {
      await expect(
        runPdfPreviewGeneration({
          file: createPreviewFile({ name: 'handout.pdf', contentType: 'application/pdf' }),
          fileId,
          claimAndUpload: vi.fn<PreviewUpload>(async (_itemId, generate) => {
            await generate()
            return uploadResult
          }),
          renderPdfPreview: vi.fn(() => Promise.resolve(new Blob(['preview']))),
        }),
      ).resolves.toEqual(
        uploadResult.status === 'error'
          ? { status: 'failed', error: uploadResult.error }
          : { status: uploadResult.status },
      )
    },
  )

  it('returns failed when rendering throws inside the claimed upload', async () => {
    const error = new Error('render failed')

    await expect(
      runPdfPreviewGeneration({
        file: createPreviewFile({ name: 'handout.pdf', contentType: 'application/pdf' }),
        fileId,
        claimAndUpload: vi.fn<PreviewUpload>(async (_itemId, generate) => {
          await generate()
          return { status: 'success' }
        }),
        renderPdfPreview: vi.fn(() => Promise.reject(error)),
      }),
    ).resolves.toEqual({ status: 'failed', error })
  })
})

function createPreviewFile({
  contentType,
  name,
  size = 1024,
  type,
}: {
  contentType?: string
  name: string
  size?: number
  type?: string
}) {
  return {
    name,
    contentType,
    type,
    size,
    arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
  }
}
