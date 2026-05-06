import { useRef } from 'react'
import { Loader2 } from 'lucide-react'
import type { GameMapWithContent } from 'convex/gameMaps/types'
import { MapPinsLayer } from '~/features/editor/components/viewer/map/map-pins-layer'
import { useMapImageStatus } from '~/features/editor/components/viewer/map/use-map-image-status'
import { MapImagePreview } from '~/features/editor/components/viewer/map/map-image-preview'
import { useMapRenderPins } from '~/features/editor/components/viewer/map/use-map-render-pins'
import { useCanvasDocumentRuntime } from '../../runtime/providers/canvas-runtime'
import { useCanvasEngine } from '../../react/use-canvas-engine'
import { resolveDefaultEmbedNodeResizeForLockedAspectRatio } from './embed-node-size'

export function EmbeddedMapContent({ nodeId, map }: { nodeId: string; map: GameMapWithContent }) {
  const { pins, isPinGhost } = useMapRenderPins(map)
  const { documentWriter } = useCanvasDocumentRuntime()
  const { patchNodeData, resizeNode } = documentWriter
  const canvasEngine = useCanvasEngine()
  const { imageLoaded, imageError, handleImageLoad, handleImageError } = useMapImageStatus(
    map._id,
    map.imageUrl,
  )
  const lastStoredAspectRatioRef = useRef<number | null>(null)
  const patchLockedAspectRatio = (aspectRatio: number) => {
    patchNodeData(new Map([[nodeId, { lockedAspectRatio: aspectRatio }]]))
    const node = canvasEngine.getSnapshot().nodeLookup.get(nodeId)?.node
    const resize = node
      ? resolveDefaultEmbedNodeResizeForLockedAspectRatio(node, aspectRatio)
      : null
    if (resize) {
      resizeNode(nodeId, resize.width, resize.height, resize.position)
    }
  }

  if (!map.imageUrl || imageError) {
    return <MapImagePreview imageUrl={imageError ? null : map.imageUrl} />
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="sr-only">Loading embedded map</span>
        </div>
      )}

      <img
        src={map.imageUrl}
        alt={map.name || 'Map'}
        className="block h-full w-full select-none object-contain"
        draggable={false}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget
          if (naturalWidth > 0 && naturalHeight > 0) {
            const aspectRatio = Number((naturalWidth / naturalHeight).toFixed(6))
            if (lastStoredAspectRatioRef.current !== aspectRatio) {
              lastStoredAspectRatioRef.current = aspectRatio
              patchLockedAspectRatio(aspectRatio)
            }
          }

          handleImageLoad()
        }}
        onError={handleImageError}
      />

      {imageLoaded && <MapPinsLayer pins={pins} isPinGhost={isPinGhost} />}
    </div>
  )
}
