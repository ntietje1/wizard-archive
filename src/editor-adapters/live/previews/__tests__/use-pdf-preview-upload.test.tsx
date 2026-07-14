import { renderHook } from '@testing-library/react'
import { runWizardEditorPdfPreviewGeneration } from '@wizard-archive/editor/adapter'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testResourceId } from '../../../../../shared/test/resource-id'
import { logger } from '~/shared/utils/logger'
import { usePdfPreviewUpload } from '../use-pdf-preview-upload'

const claimAndUploadMock = vi.hoisted(() => vi.fn())

vi.mock('../use-claim-and-upload-preview', () => ({
  useClaimAndUploadPreview: () => claimAndUploadMock,
}))

vi.mock('@wizard-archive/editor/adapter', () => ({
  runWizardEditorPdfPreviewGeneration: vi.fn(),
}))

vi.mock('~/shared/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

describe('usePdfPreviewUpload', () => {
  beforeEach(() => {
    claimAndUploadMock.mockReset()
    vi.mocked(runWizardEditorPdfPreviewGeneration).mockReset()
    vi.mocked(logger.debug).mockReset()
    vi.mocked(logger.error).mockReset()
  })

  it('logs skipped oversized previews with file id and size metadata', async () => {
    vi.mocked(runWizardEditorPdfPreviewGeneration).mockResolvedValue({
      status: 'skipped-too-large',
      size: 42,
      maxSize: 100,
    })
    const { result } = renderHook(() => usePdfPreviewUpload())

    await result.current.generatePdfPreviewIfNeeded(createPdfFile(), fileSessionId('file-1'))

    expect(logger.debug).toHaveBeenCalledExactlyOnceWith(
      `Skipping PDF preview for fileId=${fileSessionId('file-1')}: file too large (42 bytes)`,
    )
  })

  it('logs failed preview results with file id metadata', async () => {
    const error = new Error('render failed')
    vi.mocked(runWizardEditorPdfPreviewGeneration).mockResolvedValue({
      status: 'failed',
      error,
    })
    const { result } = renderHook(() => usePdfPreviewUpload())

    await result.current.generatePdfPreviewIfNeeded(createPdfFile(), fileSessionId('file-1'))

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      `PDF preview generation failed for fileId=${fileSessionId('file-1')}:`,
      error,
    )
  })

  it('logs thrown preview errors with file id metadata', async () => {
    const error = new Error('unexpected failure')
    vi.mocked(runWizardEditorPdfPreviewGeneration).mockRejectedValue(error)
    const { result } = renderHook(() => usePdfPreviewUpload())

    await expect(
      result.current.generatePdfPreviewIfNeeded(createPdfFile(), fileSessionId('file-1')),
    ).resolves.toEqual({ status: 'failed', error })
    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      `PDF preview generation failed for fileId=${fileSessionId('file-1')}:`,
      error,
    )
  })

  it.each(['unsupported', 'not-claimed', 'stale', 'published'] as const)(
    'returns %s preview results without logging an error',
    async (status) => {
      vi.mocked(runWizardEditorPdfPreviewGeneration).mockResolvedValue({ status })
      const { result } = renderHook(() => usePdfPreviewUpload())

      await expect(
        result.current.generatePdfPreviewIfNeeded(createPdfFile(), fileSessionId('file-1')),
      ).resolves.toEqual({ status })
      expect(logger.debug).not.toHaveBeenCalled()
      expect(logger.error).not.toHaveBeenCalled()
    },
  )
})

function createPdfFile() {
  return new File(['pdf'], 'private-session-notes.pdf', { type: 'application/pdf' })
}

function fileSessionId(value: string) {
  return testResourceId(value)
}
