import { useRef } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode, Ref } from 'react'
import type { MapPinWithItem } from '../../game-maps/item-contract'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  normalizeSidebarItemColorOrDefault,
} from '../../workspace/items/appearance'
import type { MapPinId } from '../../resources/domain-id'
import { getSidebarItemIcon } from '../../workspace/sidebar/item-icons'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { PinMarker } from './pin-marker'

const GHOST_PIN_COLOR = 'var(--map-pin-ghost)'

interface MapPinsLayerProps {
  ref?: Ref<HTMLDivElement>
  pins: Array<MapPinWithItem>
  isPinGhost: (pin: MapPinWithItem) => boolean
  hoveredPinId?: MapPinId | null
  draggingPinId?: MapPinId | null
  moveModePinId?: MapPinId | null
  interactive?: boolean
  onHover?: (pinId: MapPinId | null) => void
  onClick?: (event: MouseEvent, pin: MapPinWithItem) => void
  onContextMenu?: (event: MouseEvent | KeyboardEvent, pin: MapPinWithItem) => void
  onDragStart?: (event: PointerEvent, pin: MapPinWithItem) => void
  className?: string
}

export function MapPinsLayer({
  ref,
  pins,
  isPinGhost,
  hoveredPinId = null,
  draggingPinId = null,
  moveModePinId = null,
  interactive = false,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
  className,
}: MapPinsLayerProps) {
  return (
    <div ref={ref} className={cn('absolute inset-0 pointer-events-none', className)}>
      {pins.map((pin) => {
        const interaction: MapPinInteractionState = {
          isGhost: isPinGhost(pin),
          isHovered: hoveredPinId === pin.id,
          isDragging: draggingPinId === pin.id,
          isInMoveMode: moveModePinId === pin.id,
        }

        return (
          <MapPin
            key={pin.id}
            pin={pin}
            interaction={interaction}
            interactive={interactive}
            onHover={onHover}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onDragStart={onDragStart}
          />
        )
      })}
    </div>
  )
}

type MapPinInteractionState = {
  isGhost: boolean
  isHovered: boolean
  isDragging: boolean
  isInMoveMode: boolean
}

type MapPinContainerState = {
  isHovered: boolean
  isDragging: boolean
  isHidden: boolean
}

function MapPin({
  pin,
  interaction,
  interactive,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
}: {
  pin: MapPinWithItem
  interaction: MapPinInteractionState
  interactive: boolean
  onHover?: (pinId: MapPinId | null) => void
  onClick?: (event: MouseEvent, pin: MapPinWithItem) => void
  onContextMenu?: (event: MouseEvent | KeyboardEvent, pin: MapPinWithItem) => void
  onDragStart?: (event: PointerEvent, pin: MapPinWithItem) => void
}) {
  const { isHovered, isDragging, isInMoveMode } = interaction
  const presentation = getMapPinPresentation(pin, interaction.isGhost)
  const containerState = {
    isHovered,
    isDragging,
    isHidden: presentation.isHidden,
  }
  const hoverScale = interactive && isHovered && !isDragging ? 1.2 : 1

  return interactive ? (
    <InteractiveMapPin
      pin={pin}
      presentation={presentation}
      state={containerState}
      isInMoveMode={isInMoveMode}
      hoverScale={hoverScale}
      onHover={onHover}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
    />
  ) : (
    <MapPinContainer pin={pin} state={containerState}>
      <ScaledMapPinMarker scale={hoverScale}>
        <PinMarker color={presentation.color} icon={presentation.icon} />
      </ScaledMapPinMarker>
    </MapPinContainer>
  )
}

function InteractiveMapPin({
  pin,
  presentation,
  state,
  isInMoveMode,
  hoverScale,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
}: {
  pin: MapPinWithItem
  presentation: MapPinPresentation
  state: MapPinContainerState
  isInMoveMode: boolean
  hoverScale: number
  onHover?: (pinId: MapPinId | null) => void
  onClick?: (event: MouseEvent, pin: MapPinWithItem) => void
  onContextMenu?: (event: MouseEvent | KeyboardEvent, pin: MapPinWithItem) => void
  onDragStart?: (event: PointerEvent, pin: MapPinWithItem) => void
}) {
  const pendingDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    hasStarted: boolean
  } | null>(null)

  const clearPendingDrag = (event: PointerEvent<HTMLElement>) => {
    if (pendingDragRef.current?.pointerId !== event.pointerId) return
    pendingDragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  return (
    <MapPinContainer
      pin={pin}
      state={state}
      ariaLabel={presentation.itemName}
      interactive={true}
      onMouseEnter={() => onHover?.(pin.id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={
        onClick
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onClick(event, pin)
            }
          : undefined
      }
      onContextMenu={
        onContextMenu
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onContextMenu(event, pin)
            }
          : undefined
      }
      onKeyDown={
        onContextMenu
          ? (event) => {
              if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) {
                return
              }
              event.preventDefault()
              event.stopPropagation()
              onContextMenu(event, pin)
            }
          : undefined
      }
      onPointerDown={
        onDragStart
          ? (event) => {
              if (event.button !== 0 || (!event.ctrlKey && !event.metaKey && !isInMoveMode)) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture?.(event.pointerId)
              pendingDragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                hasStarted: false,
              }
            }
          : undefined
      }
      onPointerMove={
        onDragStart
          ? (event) => {
              const pendingDrag = pendingDragRef.current
              if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return
              if (pendingDrag.hasStarted) return

              const distance = Math.hypot(
                event.clientX - pendingDrag.startX,
                event.clientY - pendingDrag.startY,
              )
              if (distance < 4) return

              pendingDrag.hasStarted = true
              event.preventDefault()
              event.stopPropagation()
              onDragStart(event, pin)
            }
          : undefined
      }
      onPointerUp={clearPendingDrag}
      onPointerCancel={clearPendingDrag}
    >
      <ScaledMapPinMarker scale={hoverScale}>
        <PinMarker color={presentation.color} icon={presentation.icon} />
      </ScaledMapPinMarker>

      <MapPinTooltip
        itemName={presentation.itemName}
        isVisible={state.isHovered && !state.isDragging}
      />
    </MapPinContainer>
  )
}

function ScaledMapPinMarker({ scale, children }: { scale: number; children: ReactNode }) {
  return (
    <div
      className="transition-transform duration-100 ease-out"
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
      }}
    >
      {children}
    </div>
  )
}

function MapPinTooltip({ itemName, isVisible }: { itemName: string; isVisible: boolean }) {
  return (
    <div
      className={cn(
        'absolute left-1/2 -translate-x-1/2 bottom-full mb-1',
        'bg-popover text-popover-foreground px-2 py-1 rounded-md shadow-md',
        'text-xs font-medium whitespace-nowrap',
        'transition-all duration-100 ease-out pointer-events-none',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
      )}
    >
      {itemName}
      <div className="absolute left-1/2 -translate-x-1/2 top-full size-0 border-x-4 border-x-transparent border-t-4 border-t-popover" />
    </div>
  )
}

function MapPinContainer({
  pin,
  state,
  children,
  ariaLabel,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
}: {
  pin: MapPinWithItem
  state: MapPinContainerState
  children: ReactNode
  ariaLabel?: string
  interactive?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
}) {
  const className = cn(
    'absolute',
    interactive
      ? 'pointer-events-auto cursor-pointer border-0 bg-transparent p-0'
      : 'pointer-events-none',
    state.isHovered && !state.isDragging && 'z-20',
    state.isDragging && 'z-30 opacity-70',
    state.isHidden && !state.isDragging && 'opacity-60',
  )
  const style = {
    left: `${pin.x}%`,
    top: `${pin.y}%`,
    transform: 'translate(-50%, -100%) scale(var(--pin-scale, 1))',
    transformOrigin: 'bottom center',
  } as const

  if (interactive) {
    return (
      <button
        type="button"
        data-pin-id={pin.id}
        aria-label={ariaLabel}
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
      >
        {children}
      </button>
    )
  }

  return (
    <div data-pin-id={pin.id} className={className} style={style}>
      {children}
    </div>
  )
}

type MapPinPresentation = {
  color: string
  icon: ReturnType<typeof getSidebarItemIcon>
  itemName: string
  isHidden: boolean
}

function getMapPinPresentation(pin: MapPinWithItem, isGhost: boolean): MapPinPresentation {
  // Ghost pins can still have an item; hide item details when permissions make them ghosts.
  const presentationItem = isGhost ? undefined : (pin.item ?? undefined)
  const color = isGhost
    ? GHOST_PIN_COLOR
    : normalizeSidebarItemColorOrDefault(presentationItem?.color, DEFAULT_SIDEBAR_ITEM_COLOR)
  const isHidden = pin.visible !== true
  const baseName = isGhost ? '???' : (presentationItem?.name ?? '')

  return {
    color,
    icon: getSidebarItemIcon(presentationItem),
    itemName: isHidden ? `${baseName} (hidden)` : baseName,
    isHidden,
  }
}
