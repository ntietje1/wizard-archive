import { useCallback } from 'react'
import { generatePdfPreview } from '../utils/generate-preview'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

const MAX_PDF_PREVIEW_SIZE = 50 * 1024 * 1024

export function usePdfPreviewUpload() {
  const claimAndUpload = useClaimAndUploadPreview()

  const generatePdfPreviewIfNeeded = useCallback(
    async (file: File, fileId: Id<'files'>) => {
      if (!isPdfFile(file)) return
      if (file.size > MAX_PDF_PREVIEW_SIZE) {
        logger.debug(
          `Skipping PDF preview for fileId=${fileId}: file too large (${file.size} bytes)`,
        )
        return
      }
      try {
        const buffer = await file.arrayBuffer()
        await claimAndUpload(fileId, () => generatePdfPreview(buffer))
      } catch (error) {
        logger.error(
          `PDF preview generation failed for fileId=${fileId}:`,
          error,
        )
      }
    },
    [claimAndUpload],
  )

  return { generatePdfPreviewIfNeeded }
}
