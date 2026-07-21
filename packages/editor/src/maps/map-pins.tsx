import { MapPin as MapPinIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { MapPinId, ResourceId } from '../resources/domain-id'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import type {
  MapContentCommand,
  MapResourceContent,
  MapSession,
} from '../resources/content-session-contract'
import type { AuthorizedResourceSummary } from '../resources/resource-index-contract'
import { presentExternalUrl } from '../resources/external-url-presentation'
import {
  clearWorkspaceResourceDropTarget,
  leaveWorkspaceResourceDrop,
  markWorkspaceResourceSurfaceDrop,
  hasWorkspaceResourceDrag,
  readWorkspaceResourceDrag,
  workspaceResourceSurfaceDropLabel,
} from '../resources/workspace-resource-drag'
import { MapImagePinLayout } from './map-image-pin-layout'
import { planMapResourcePins } from './map-pin-placement'

type MapPin = MapResourceContent['pins'][number]
type PinFeedback = Readonly<{
  message: string
  retry: MapContentCommand | null
  failed: boolean
}>

export function MapPinSurface({
  canEdit,
  focusedPinId,
  imageRef,
  layerId,
  mapResourceId,
  openDestination,
  resolveResource,
  session,
  src,
  title,
}: {
  canEdit: boolean
  focusedPinId: MapPinId | null
  imageRef: RefObject<HTMLImageElement | null>
  layerId: string | null
  mapResourceId: ResourceId
  openDestination: (destination: AuthoredDestination) => void
  resolveResource: (resourceId: ResourceId) => AuthorizedResourceSummary | null
  session: MapSession
  src: string
  title: string
}) {
  const [selection, setSelection] = useState<{
    focusedPinId: MapPinId | null
    selectedPinId: MapPinId | null
  }>({ focusedPinId, selectedPinId: focusedPinId })
  const [movingPinId, setMovingPinId] = useState<MapPinId | null>(null)
  const [menu, setMenu] = useState<{ pin: MapPin; x: number; y: number } | null>(null)
  const [feedback, setFeedback] = useState<PinFeedback | null>(null)
  const pendingDrag = useRef<{
    pinId: MapPinId
    pointerId: number
    startX: number
    startY: number
  } | null>(null)
  const pins = session.content.pins.filter(
    (pin) => pin.layerId === layerId && (canEdit || pin.visible),
  )
  const selectedPinId =
    selection.focusedPinId === focusedPinId ? selection.selectedPinId : focusedPinId
  const selectPin = (pinId: MapPinId) => setSelection({ focusedPinId, selectedPinId: pinId })
  const planResourceDrop = (
    dataTransfer: Pick<DataTransfer, 'getData'>,
    input: { clientX: number; clientY: number },
  ) => {
    const drag = readWorkspaceResourceDrag(dataTransfer)
    const position = imagePosition(imageRef.current, input)
    if (
      !drag ||
      !position ||
      drag.resourceIds.some((resourceId) => resolveResource(resourceId)?.lifecycle !== 'active')
    ) {
      return {
        status: 'rejected' as const,
        feedback: {
          status: 'rejected' as const,
          label: position ? 'Some resources are unavailable' : 'Drop resources on the map image',
        },
      }
    }
    const command = planMapResourcePins({
      existingPins: session.content.pins,
      layerId,
      mapResourceId,
      position,
      resourceIds: drag.resourceIds,
    })
    return command
      ? {
          status: 'accepted' as const,
          command,
          feedback: workspaceResourceSurfaceDropLabel('mapPin', command.pins.length, title),
        }
      : {
          status: 'rejected' as const,
          feedback: {
            status: 'rejected' as const,
            label: 'Those resources are already pinned or unavailable',
          },
        }
  }

  const execute = async (command: MapContentCommand, success: string) => {
    const result = await session.execute(command)
    if (result.status === 'completed') {
      setFeedback({ message: success, retry: null, failed: false })
      return
    }
    setFeedback({
      message: mapPinFailure(result.reason),
      retry: result.status === 'retryable' || result.reason === 'version_conflict' ? command : null,
      failed: true,
    })
  }

  const movePin = (pinId: MapPinId, input: { clientX: number; clientY: number }) => {
    const position = imagePosition(imageRef.current, input)
    if (!position) {
      setFeedback({ message: 'Choose a point on the map image.', retry: null, failed: true })
      return
    }
    setMovingPinId(null)
    void execute({ type: 'movePin', pinId, ...position }, 'Pin moved')
  }

  return (
    <MapImagePinLayout
      alt={`${title} map`}
      aria-label="Map canvas"
      className="data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-primary"
      imageRef={imageRef}
      pins={pins.map((pin) => {
        const targetId = pinDestinationResourceId(pin)
        const target = targetId ? resolveResource(targetId) : null
        const label = pinLabel(pin, target)
        return (
          <button
            key={pin.id}
            type="button"
            aria-label={pin.visible ? label : `${label} (hidden)`}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-full border-2 border-background p-1 text-white shadow-md outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring data-[hidden=true]:opacity-50 data-[selected=true]:ring-2 data-[selected=true]:ring-ring"
            data-hidden={!pin.visible}
            data-selected={selectedPinId === pin.id}
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              backgroundColor: target?.color ?? '#7c3aed',
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              selectPin(pin.id)
              setMenu(null)
              openDestination(pin.destination)
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              selectPin(pin.id)
              setMenu({ pin, x: event.clientX, y: event.clientY })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') openDestination(pin.destination)
            }}
            onPointerDown={(event) => {
              if (!canEdit || event.button !== 0) return
              pendingDrag.current = {
                pinId: pin.id,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
              }
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }}
            onPointerUp={(event) => {
              const pending = pendingDrag.current
              pendingDrag.current = null
              if (!pending || pending.pointerId !== event.pointerId) return
              if (Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY) >= 4) {
                event.preventDefault()
                event.stopPropagation()
                movePin(pending.pinId, event)
              }
            }}
          >
            <MapPinIcon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
      role="region"
      src={src}
      onClick={(event) => {
        setMenu(null)
        if (movingPinId) movePin(movingPinId, event)
      }}
      onDragLeave={leaveWorkspaceResourceDrop}
      onDragOver={(event) => {
        if (!canEdit || !hasWorkspaceResourceDrag(event.dataTransfer)) return
        markWorkspaceResourceSurfaceDrop(
          event,
          planResourceDrop(event.dataTransfer, event).feedback,
        )
      }}
      onDrop={(event) => {
        if (!canEdit || !hasWorkspaceResourceDrag(event.dataTransfer)) return
        const plan = planResourceDrop(event.dataTransfer, event)
        event.preventDefault()
        event.stopPropagation()
        clearWorkspaceResourceDropTarget(event.currentTarget)
        if (plan.status === 'rejected') {
          setFeedback({
            message: `${plan.feedback.label}.`,
            retry: null,
            failed: true,
          })
          return
        }
        void execute(
          plan.command,
          plan.command.pins.length === 1
            ? 'Pin created'
            : `${plan.command.pins.length} pins created`,
        )
      }}
    >
      {movingPinId && (
        <div className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm font-medium">
          Click the map to move the pin
        </div>
      )}
      {feedback && (
        <div
          className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm shadow"
          role={feedback.failed ? 'alert' : 'status'}
        >
          <span>{feedback.message}</span>
          {feedback.retry && (
            <button
              type="button"
              className="underline"
              onClick={() => void execute(feedback.retry!, 'Map updated')}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {menu && (
        <PinMenu
          canEdit={canEdit}
          menu={menu}
          onClose={() => setMenu(null)}
          onMove={() => {
            setMovingPinId(menu.pin.id)
            setMenu(null)
          }}
          onRemove={() => {
            void execute({ type: 'removePin', pinId: menu.pin.id }, 'Pin removed')
            setMenu(null)
          }}
          onVisibility={() => {
            void execute(
              { type: 'setPinVisibility', pinId: menu.pin.id, visible: !menu.pin.visible },
              menu.pin.visible ? 'Pin hidden' : 'Pin shown',
            )
            setMenu(null)
          }}
        />
      )}
    </MapImagePinLayout>
  )
}

function PinMenu({
  canEdit,
  menu,
  onClose,
  onMove,
  onRemove,
  onVisibility,
}: {
  canEdit: boolean
  menu: { pin: MapPin; x: number; y: number }
  onClose: () => void
  onMove: () => void
  onRemove: () => void
  onVisibility: () => void
}) {
  if (!canEdit) return null
  return (
    <div
      role="menu"
      aria-label="Map pin actions"
      className="fixed z-50 min-w-32 rounded-md border border-border bg-popover p-1 text-sm shadow-md"
      style={{ left: menu.x, top: menu.y }}
      onClick={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose()
      }}
    >
      <PinMenuButton label={menu.pin.visible ? 'Hide pin' : 'Show pin'} onClick={onVisibility} />
      <PinMenuButton label="Move pin" onClick={onMove} />
      <PinMenuButton label="Remove pin" onClick={onRemove} />
    </div>
  )
}

function PinMenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function pinDestinationResourceId(pin: MapPin): ResourceId | null {
  return pin.destination.kind === 'internal' ? pin.destination.target.resourceId : null
}

function pinLabel(pin: MapPin, target: AuthorizedResourceSummary | null): string {
  if (target) return target.title
  if (pin.destination.kind === 'externalUrl') return presentExternalUrl(pin.destination.url).title
  if (pin.destination.kind === 'unresolved') return pin.destination.rawTarget
  return 'Unavailable resource'
}

function imagePosition(
  image: HTMLImageElement | null,
  input: { clientX: number; clientY: number },
): { x: number; y: number } | null {
  if (!image) return null
  const bounds = image.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return null
  const x = ((input.clientX - bounds.left) / bounds.width) * 100
  const y = ((input.clientY - bounds.top) / bounds.height) * 100
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return null
  }
  return { x, y }
}

function mapPinFailure(reason: string): string {
  switch (reason) {
    case 'content_initializing':
      return 'The map is still being prepared.'
    case 'response_lost':
      return 'The map change could not be confirmed.'
    case 'version_conflict':
      return 'The map changed before this pin update completed.'
    case 'pin_missing':
      return 'The selected pin no longer exists.'
    case 'target_missing':
      return 'A pinned resource is unavailable.'
    case 'unauthorized':
    case 'resource_missing':
      return 'You can no longer edit this map.'
    default:
      return 'The map pin could not be updated.'
  }
}
