import { Image as ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type {
  MapContentMutationResult,
  MapImageAttachment,
  MapResourceContent,
  MapSession,
} from '../resources/content-session-contract'
import type { ResourceId } from '../resources/domain-id'
import type { AuthorizedResourceSummary } from '../resources/resource-index-contract'
import { MapPinSurface } from './map-pins'
import { useAssetReplacement } from '../resources/asset-replacement'
import type { AssetReplacementController } from '../resources/asset-replacement'
import { AssetReplacementButton } from '../resources/asset-replacement-button'
import { beginContentObjectUrlLoad } from '../resources/content-object-url'
import type { ContentObjectUrlState } from '../resources/content-object-url'

type MapImageState = { readonly status: 'empty' } | ContentObjectUrlState

export function MapViewer({
  canEdit,
  mapResourceId,
  openResource,
  resolveResource,
  session,
  title,
}: {
  canEdit: boolean
  mapResourceId: ResourceId
  openResource: (resourceId: ResourceId) => void
  resolveResource: (resourceId: ResourceId) => AuthorizedResourceSummary | null
  session: MapSession
  title: string
}) {
  const layer = useSelectedMapLayer(session)
  const replacement = useMapImageReplacement(session, mapResourceId, layer.id)
  const transform = useRef<ReactZoomPanPinchRef>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      aria-label="Map content"
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20 data-[map-drag-active=true]:ring-2 data-[map-drag-active=true]:ring-inset data-[map-drag-active=true]:ring-ring"
      data-map-drag-active={replacement.dragActive}
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
      onClick={() => setMenu(null)}
      onDragLeave={canEdit ? replacement.onDragLeave : undefined}
      onDragOver={canEdit ? replacement.onDragOver : undefined}
      onDrop={canEdit ? replacement.onDrop : undefined}
    >
      <MapViewerHeader
        canEdit={canEdit}
        image={layer.image}
        layerId={layer.id}
        layerName={layer.name}
        layers={session.content.layers}
        onSelectLayer={layer.select}
        replacement={replacement}
        title={title}
        transform={transform}
      />
      {!canEdit && (
        <div className="shrink-0 border-b bg-background px-3 py-2 text-center text-sm text-muted-foreground">
          Viewing map — changes are disabled
        </div>
      )}
      <MapReplacementStatus replacement={replacement} />
      <MapImageCanvas
        image={layer.image}
        imageRef={imageRef}
        layerId={layer.id}
        mapResourceId={mapResourceId}
        openResource={openResource}
        replacement={replacement}
        session={session}
        resolveResource={resolveResource}
        title={title}
        transform={transform}
        canEdit={canEdit}
        onContextMenu={(event) => {
          event.preventDefault()
          setMenu({ x: event.clientX, y: event.clientY })
        }}
      />
      <MapImageActionsMenu
        canEdit={canEdit}
        menu={menu}
        onClose={() => setMenu(null)}
        replacement={replacement}
        transform={transform}
      />
    </div>
  )
}

function useSelectedMapLayer(session: MapSession) {
  const layers = session.content.layers
  const [selected, setSelected] = useState<{ session: MapSession; layerId: string | null }>(() => ({
    session,
    layerId: layers[0]?.id ?? null,
  }))
  const validSelection =
    selected.session === session &&
    (selected.layerId === null || layers.some((layer) => layer.id === selected.layerId))
  const id = validSelection ? selected.layerId : (layers[0]?.id ?? null)
  const selectedLayer = id === null ? null : layers.find((layer) => layer.id === id)!
  return {
    id,
    image: selectedLayer?.image ?? session.content.image,
    name: selectedLayer?.name ?? 'Base map',
    select: (layerId: string | null) => setSelected({ session, layerId }),
  }
}

function MapViewerHeader({
  canEdit,
  image,
  layerId,
  layerName,
  layers,
  onSelectLayer,
  replacement,
  title,
  transform,
}: {
  canEdit: boolean
  image: MapImageAttachment
  layerId: string | null
  layerName: string
  layers: MapResourceContent['layers']
  onSelectLayer: (layerId: string | null) => void
  replacement: MapImageReplacementController
  title: string
  transform: React.RefObject<ReactZoomPanPinchRef | null>
}) {
  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{layerName}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {layers.length > 0 && (
          <select
            aria-label="Map layer"
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={layerId ?? ''}
            onChange={(event) => onSelectLayer(event.currentTarget.value || null)}
          >
            <option value="">Base map</option>
            {layers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        )}
        <MapTransformControls transform={transform} />
        {canEdit && image.status === 'attached' && (
          <MapImageControl compact replacement={replacement} />
        )}
      </div>
    </header>
  )
}

function MapReplacementStatus({ replacement }: { replacement: MapImageReplacementController }) {
  if (!replacement.message) return null
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-2 text-sm">
      <p role={replacement.failed ? 'alert' : 'status'}>{replacement.message}</p>
      {replacement.canRetry && (
        <button type="button" className="underline" onClick={replacement.retry}>
          Try again
        </button>
      )}
    </div>
  )
}

function MapImageActionsMenu({
  canEdit,
  menu,
  onClose,
  replacement,
  transform,
}: {
  canEdit: boolean
  menu: { x: number; y: number } | null
  onClose: () => void
  replacement: MapImageReplacementController
  transform: React.RefObject<ReactZoomPanPinchRef | null>
}) {
  if (!menu) return null
  return (
    <div
      role="menu"
      aria-label="Map image actions"
      className="fixed z-50 min-w-36 rounded-md border border-border bg-popover p-1 text-sm shadow-md"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted"
        onClick={() => {
          transform.current?.resetTransform()
          onClose()
        }}
      >
        Fit map
      </button>
      {canEdit && (
        <button
          type="button"
          role="menuitem"
          className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted"
          onClick={() => {
            replacement.open()
            onClose()
          }}
        >
          Replace image
        </button>
      )}
    </div>
  )
}

function MapImageCanvas({
  canEdit,
  image,
  imageRef,
  layerId,
  mapResourceId,
  onContextMenu,
  openResource,
  replacement,
  session,
  resolveResource,
  title,
  transform,
}: {
  canEdit: boolean
  image: MapImageAttachment
  imageRef: React.RefObject<HTMLImageElement | null>
  layerId: string | null
  mapResourceId: ResourceId
  onContextMenu: (event: ReactMouseEvent) => void
  openResource: (resourceId: ResourceId) => void
  replacement: MapImageReplacementController
  session: MapSession
  resolveResource: (resourceId: ResourceId) => AuthorizedResourceSummary | null
  title: string
  transform: React.RefObject<ReactZoomPanPinchRef | null>
}) {
  const { retry, state } = useMapImageUrl(session, layerId, image)
  if (state.status === 'empty') {
    return (
      <MapState
        title="No map image"
        description={canEdit ? 'Upload an image to begin placing map content.' : undefined}
        action={canEdit ? <MapImageControl replacement={replacement} /> : undefined}
      />
    )
  }
  if (state.status === 'loading') return <MapState title="Loading map image…" />
  if (state.status === 'failed') {
    return (
      <MapState
        title="Could not load the map image"
        action={
          <button type="button" className="mt-3 text-sm underline" onClick={retry}>
            Try again
          </button>
        }
      />
    )
  }
  if (state.status === 'unavailable') {
    return <MapState title="Map image unavailable" description={state.reason} />
  }
  if (state.status === 'integrity_error') {
    return <MapState title="Map image could not be verified" description={state.issue} />
  }
  return (
    <div className="min-h-0 flex-1" onContextMenu={onContextMenu}>
      <TransformWrapper
        ref={transform}
        centerOnInit
        limitToBounds={false}
        maxScale={4}
        minScale={0.25}
        wheel={{ step: 0.1 }}
      >
        <TransformComponent
          wrapperClass="!h-full !w-full"
          contentClass="!h-full !w-full flex items-center justify-center"
        >
          <MapPinSurface
            canEdit={canEdit}
            imageRef={imageRef}
            layerId={layerId}
            mapResourceId={mapResourceId}
            openResource={openResource}
            resolveResource={resolveResource}
            session={session}
            src={state.url}
            title={title}
          />
        </TransformComponent>
      </TransformWrapper>
    </div>
  )
}

function MapTransformControls({
  transform,
}: {
  transform: React.RefObject<ReactZoomPanPinchRef | null>
}) {
  return (
    <div className="flex items-center rounded-md border border-border">
      <button
        type="button"
        aria-label="Zoom out"
        className="h-8 px-2 hover:bg-muted"
        onClick={() => transform.current?.zoomOut()}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Fit map"
        className="h-8 border-x border-border px-2 text-xs hover:bg-muted"
        onClick={() => transform.current?.resetTransform()}
      >
        Fit
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        className="h-8 px-2 hover:bg-muted"
        onClick={() => transform.current?.zoomIn()}
      >
        +
      </button>
    </div>
  )
}

type MapImageReplacementController = AssetReplacementController

function useMapImageReplacement(
  session: MapSession,
  mapResourceId: ResourceId,
  layerId: string | null,
): MapImageReplacementController {
  return useAssetReplacement({
    target: {
      owner: session,
      key: JSON.stringify([
        mapResourceId,
        layerId,
        session.version.revision,
        session.version.digest,
      ]),
      value: { session, mapResourceId, layerId, expectedVersion: session.version },
    },
    replace: async (target, source) =>
      await target.session.replaceImage(target.layerId, target.expectedVersion, source),
    message: mapImageMutationMessage,
    retryable: (result) => result.status === 'retryable' || result.reason === 'version_conflict',
    readingMessage: 'Reading map image…',
    uploadingMessage: 'Uploading map image…',
    readFailureMessage: 'The selected image could not be read.',
    responseLostMessage: 'The map image replacement could not be confirmed.',
  })
}

function MapImageControl({
  compact = false,
  replacement,
}: {
  compact?: boolean
  replacement: MapImageReplacementController
}) {
  return (
    <div className={compact ? '' : 'mt-4 flex flex-col items-center gap-2'}>
      <AssetReplacementButton
        ariaLabel="Choose map image"
        compact={compact}
        compactLabel="Replace image"
        fullLabel="Choose image"
        pendingLabel="Uploading…"
        replacement={replacement}
      />
      {!compact && (
        <p className="text-xs text-muted-foreground">
          {replacement.dragActive ? 'Drop the image here' : 'Or drag and drop an image here'}
        </p>
      )}
    </div>
  )
}

function useMapImageUrl(session: MapSession, layerId: string | null, image: MapImageAttachment) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<MapImageState>(
    image.status === 'unattached' ? { status: 'empty' } : { status: 'loading' },
  )
  const attachmentKey = image.status === 'attached' ? image.digest : image.status
  useEffect(() => {
    if (image.status === 'unattached') {
      setState({ status: 'empty' })
      return
    }
    return beginContentObjectUrlLoad(() => session.loadImage(layerId), setState)
  }, [attempt, attachmentKey, image.status, layerId, session])
  return { retry: () => setAttempt((current) => current + 1), state }
}

function mapImageMutationMessage(
  result: Exclude<MapContentMutationResult, { status: 'completed' }>,
) {
  switch (result.reason) {
    case 'content_initializing':
      return 'The map is still being prepared.'
    case 'response_lost':
      return 'The map image replacement could not be confirmed.'
    case 'version_conflict':
      return 'This map changed while the image was uploading.'
    case 'layer_missing':
      return 'The selected map layer no longer exists.'
    case 'content_corrupt':
    case 'content_missing':
      return 'The existing map content is unavailable.'
    case 'invalid_command':
      return 'The map change was invalid.'
    case 'operation_id_reused':
      return 'The map change could not be safely retried.'
    case 'pin_missing':
      return 'The selected map pin no longer exists.'
    case 'resource_missing':
    case 'unauthorized':
      return 'You can no longer edit this map.'
    case 'target_missing':
      return 'The pinned resource is unavailable.'
    case 'version_exhausted':
      return 'This map cannot accept another revision.'
  }
}

function MapState({
  action,
  description,
  title,
}: {
  action?: ReactNode
  description?: string
  title: string
}) {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center">
        <ImageIcon className="mb-3 size-9 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </div>
  )
}
