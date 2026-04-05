import { useCallback } from 'react'
import { generatePdfPreview } from '../utils/generate-preview'
import { useClaimAndUploadPreview } from './use-claim-and-upload-preview'
import type { Id } from 'convex/_generated/dataModel'

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.endsWith('.pdf')
}

export function usePdfPreviewUpload() {
  const claimAndUpload = useClaimAndUploadPreview()

  const generatePdfPreviewIfNeeded = useCallback(
    async (file: File, fileId: Id<'files'>) => {
      if (!isPdfFile(file)) return
      const buffer = await file.arrayBuffer()
      await claimAndUpload(fileId, () => generatePdfPreview(buffer))
    },
    [claimAndUpload],
  )

  return { generatePdfPreviewIfNeeded }
}
