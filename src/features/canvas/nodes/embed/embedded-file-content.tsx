import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { FileWithContent } from 'convex/files/types'
import { FilePreview } from '~/features/editor/components/viewer/file/file-preview'
import { resolveFilePreviewImageUrl } from '~/features/editor/components/viewer/file/file-preview-source'
import { useCanvasRuntime } from '../../runtime/providers/canvas-runtime'

export function EmbeddedFileContent({ nodeId, file }: { nodeId: string; file: FileWithContent }) {
  const {
    documentWriter: { patchNodeData },
  } = useCanvasRuntime()
  const [erroredUrls, setErroredUrls] = useState<Set<string>>(() => new Set())
  const lastStoredAspectRatioRef = useRef<number | null>(null)
  const visualSourceUrl = resolveFilePreviewImageUrl({
    downloadUrl: file.downloadUrl,
    contentType: file.contentType,
    previewUrl: file.previewUrl,
    erroredUrls,
  })

  useEffect(() => {
    if (visualSourceUrl) {
      return
    }

    if (lastStoredAspectRatioRef.current === null) {
      return
    }

    lastStoredAspectRatioRef.current = null
    patchNodeData(new Map([[nodeId, { lockedAspectRatio: null }]]))
  }, [nodeId, patchNodeData, visualSourceUrl])

  if (!visualSourceUrl) {
    return (
      <FilePreview
        downloadUrl={file.downloadUrl}
        contentType={file.contentType}
        previewUrl={file.previewUrl}
        alt={file.name}
      />
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span className="sr-only">Loading embedded file preview</span>
      </div>

      <img
        src={visualSourceUrl}
        alt={file.name || 'File preview'}
        className="relative z-10 block h-full w-full select-none"
        draggable={false}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget
          if (naturalWidth > 0 && naturalHeight > 0) {
            const aspectRatio = Number((naturalWidth / naturalHeight).toFixed(6))
            if (lastStoredAspectRatioRef.current !== aspectRatio) {
              lastStoredAspectRatioRef.current = aspectRatio
              patchNodeData(new Map([[nodeId, { lockedAspectRatio: aspectRatio }]]))
            }
          }
        }}
        onError={() => {
          setErroredUrls((current) => new Set(current).add(visualSourceUrl))
        }}
      />
    </div>
  )
}
