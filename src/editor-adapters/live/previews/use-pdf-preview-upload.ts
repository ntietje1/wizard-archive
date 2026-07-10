import { runWizardEditorPdfPreviewGeneration } from '@wizard-archive/editor/adapter'
import type { WizardEditorFileSessionReplaceInput } from '@wizard-archive/editor/adapter'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import { logger } from '~/shared/utils/logger'
import { assertNever } from '~/shared/utils/utils'

type LivePdfPreviewFile = File | WizardEditorFileSessionReplaceInput['file']

export function usePdfPreviewUpload() {
  const claimAndUpload = useClaimAndUploadPreview()

  async function generatePdfPreviewIfNeeded(
    file: LivePdfPreviewFile,
    fileId: WizardEditorFileSessionReplaceInput['fileId'],
    options?: { signal?: AbortSignal },
  ) {
    try {
      const result = await runWizardEditorPdfPreviewGeneration({
        file,
        fileId,
        claimAndUpload,
        options,
      })
      switch (result.status) {
        case 'unsupported':
        case 'not-claimed':
        case 'stale':
        case 'published':
          break
        case 'skipped-too-large':
          logger.debug(
            `Skipping PDF preview for fileId=${fileId}: file too large (${result.size} bytes)`,
          )
          break
        case 'failed':
          logger.error(`PDF preview generation failed for fileId=${fileId}:`, result.error)
          break
        default:
          assertNever(result)
      }
      return result
    } catch (error) {
      logger.error(`PDF preview generation failed for fileId=${fileId}:`, error)
      return { status: 'failed' as const, error }
    }
  }

  return { generatePdfPreviewIfNeeded }
}
