import { Image as ImageIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import type { ReactZoomPanPinchRef } from 'react-zoom-pan-pinch'
import type {
  MapImageAttachment,
  MapResourceContent,
  MapSession,
} from '../resources/content-session-contract'
import type { MapPinId, ResourceId } from '../resources/domain-id'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import type { AuthorizedResourceSummary } from '../resources/resource-index-contract'
import { MapPinSurface } from './map-pins'
import { useMapImageUrl } from './use-map-image-url'
import { resolveMapFocus } from './map-focus'
import type { MapFocus } from './map-focus'

export function MapViewer({
  canEdit,
  focusedPinId,
  mapResourceId,
  openDestination,
  resolveResource,
  session,
  title,
}: {
  canEdit: boolean
  focusedPinId?: MapPinId | null
  mapResourceId: ResourceId
  openDestination: (destination: AuthoredDestination) => void
  resolveResource: (resourceId: ResourceId) => AuthorizedResourceSummary | null
  session: MapSession
  title: string
}) {
  const layer = useSelectedMapLayer(session, focusedPinId ?? null)
  const transform = useRef<ReactZoomPanPinchRef>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      aria-label="Map content"
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20"
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
      onClick={() => setMenu(null)}
    >
      <MapFloatingControls
        image={layer.image}
        layerId={layer.id}
        layers={session.content.layers}
        onSelectLayer={layer.select}
        transform={transform}
      />
      <MapImageCanvas
        image={layer.image}
        imageRef={imageRef}
        focusedPinId={focusedPinId ?? null}
        layerId={layer.id}
        mapResourceId={mapResourceId}
        openDestination={openDestination}
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
      <MapImageActionsMenu menu={menu} onClose={() => setMenu(null)} transform={transform} />
    </div>
  )
}

function useSelectedMapLayer(session: MapSession, focusedPinId: MapPinId | null) {
  const layers = session.content.layers
  const focus = resolveMapFocus(session.content, focusedPinId)
  const [selected, setSelected] = useState<{
    focus: MapFocus
    session: MapSession
    layerId: string | null
  }>(() => ({ focus, session, layerId: initialMapLayerId(focus, layers) }))
  const validSelection =
    selected.session === session &&
    mapFocusesEqual(selected.focus, focus) &&
    (selected.layerId === null || layers.some((layer) => layer.id === selected.layerId))
  const id = validSelection ? selected.layerId : initialMapLayerId(focus, layers)
  const selectedLayer = id === null ? null : layers.find((layer) => layer.id === id)!
  return {
    id,
    image: selectedLayer?.image ?? session.content.image,
    select: (layerId: string | null) => setSelected({ focus, session, layerId }),
  }
}

function initialMapLayerId(focus: MapFocus, layers: MapResourceContent['layers']) {
  switch (focus.kind) {
    case 'base':
      return null
    case 'layer':
      return focus.layerId
    case 'missing':
    case 'none':
      return layers[0]?.id ?? null
  }
}

function mapFocusesEqual(left: MapFocus, right: MapFocus) {
  if (left.kind !== right.kind) return false
  switch (left.kind) {
    case 'none':
      return true
    case 'base':
      return right.kind === 'base' && left.pinId === right.pinId
    case 'layer':
      return right.kind === 'layer' && left.pinId === right.pinId && left.layerId === right.layerId
    case 'missing':
      return right.kind === 'missing' && left.pinId === right.pinId
  }
}

function MapFloatingControls({
  image,
  layerId,
  layers,
  onSelectLayer,
  transform,
}: {
  image: MapImageAttachment
  layerId: string | null
  layers: MapResourceContent['layers']
  onSelectLayer: (layerId: string | null) => void
  transform: React.RefObject<ReactZoomPanPinchRef | null>
}) {
  return (
    <>
      {layers.length > 0 && (
        <div
          aria-label="Map layers"
          className="absolute left-3 top-3 z-10 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1 overflow-x-auto rounded-md border border-border bg-background/95 p-1 shadow-sm"
          role="toolbar"
        >
          <MapLayerButton
            active={layerId === null}
            label="Base map"
            onSelect={() => onSelectLayer(null)}
          />
          {layers.map((layer) => (
            <MapLayerButton
              active={layer.id === layerId}
              key={layer.id}
              label={layer.name}
              onSelect={() => onSelectLayer(layer.id)}
            />
          ))}
        </div>
      )}
      {image.status === 'attached' && (
        <div className="absolute right-3 top-3 z-10">
          <MapTransformControls transform={transform} />
        </div>
      )}
    </>
  )
}

function MapLayerButton({
  active,
  label,
  onSelect,
}: {
  active: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className="h-7 shrink-0 rounded px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

function MapImageActionsMenu({
  menu,
  onClose,
  transform,
}: {
  menu: { x: number; y: number } | null
  onClose: () => void
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
    </div>
  )
}

function MapImageCanvas({
  canEdit,
  focusedPinId,
  image,
  imageRef,
  layerId,
  mapResourceId,
  onContextMenu,
  openDestination,
  session,
  resolveResource,
  title,
  transform,
}: {
  canEdit: boolean
  focusedPinId: MapPinId | null
  image: MapImageAttachment
  imageRef: React.RefObject<HTMLImageElement | null>
  layerId: string | null
  mapResourceId: ResourceId
  onContextMenu: (event: ReactMouseEvent) => void
  openDestination: (destination: AuthoredDestination) => void
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
            focusedPinId={focusedPinId}
            imageRef={imageRef}
            layerId={layerId}
            mapResourceId={mapResourceId}
            openDestination={openDestination}
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
