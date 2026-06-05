import { runPdfPreviewGeneration } from '../pdf-preview-adapter'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'

export function usePdfPreviewUpload() {
  const claimAndUpload = useClaimAndUploadPreview()

  async function generatePdfPreviewIfNeeded(file: File, fileId: Id<'sidebarItems'>) {
    const result = await runPdfPreviewGeneration({ file, fileId, claimAndUpload })
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
    }
    return result
  }

  return { generatePdfPreviewIfNeeded }
}
