import { generatePdfPreview } from './utils/generate-preview'
import type { Id } from 'convex/_generated/dataModel'

const MAX_PDF_PREVIEW_SIZE = 50 * 1024 * 1024

type PdfPreviewGenerationResult =
  | { status: 'unsupported' }
  | { status: 'skipped-too-large'; size: number; maxSize: number }
  | { status: 'published' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'failed'; error: unknown }

type ClaimAndUploadPreview = (
  itemId: Id<'sidebarItems'>,
  generate: () => Promise<Blob>,
  options?: { signal?: AbortSignal },
) => Promise<
  | { status: 'success' }
  | { status: 'not-claimed' }
  | { status: 'stale' }
  | { status: 'error'; error: unknown }
>

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export async function runPdfPreviewGeneration({
  file,
  fileId,
  claimAndUpload,
  renderPdfPreview = generatePdfPreview,
  options,
}: {
  file: File
  fileId: Id<'sidebarItems'>
  claimAndUpload: ClaimAndUploadPreview
  renderPdfPreview?: (source: ArrayBuffer, options?: { signal?: AbortSignal }) => Promise<Blob>
  options?: { signal?: AbortSignal }
}): Promise<PdfPreviewGenerationResult> {
  if (!isPdfFile(file)) return { status: 'unsupported' }
  if (file.size > MAX_PDF_PREVIEW_SIZE) {
    return { status: 'skipped-too-large', size: file.size, maxSize: MAX_PDF_PREVIEW_SIZE }
  }

  try {
    const result = await claimAndUpload(
      fileId,
      async () => {
        const buffer = await file.arrayBuffer()
        return renderPdfPreview(buffer, options)
      },
      { signal: options?.signal },
    )
    if (result.status === 'success') return { status: 'published' }
    if (result.status === 'not-claimed') return { status: 'not-claimed' }
    if (result.status === 'stale') return { status: 'stale' }
    return { status: 'failed', error: result.error }
  } catch (error) {
    return { status: 'failed', error }
  }
}
