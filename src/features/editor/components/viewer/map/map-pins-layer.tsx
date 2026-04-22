import { forwardRef } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import {
  DEFAULT_SIDEBAR_ITEM_COLOR,
  normalizeSidebarItemColorOrDefault,
} from 'convex/sidebarItems/validation/color'
import type { MapPinWithItem } from 'convex/gameMaps/types'
import type { Id } from 'convex/_generated/dataModel'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { cn } from '~/features/shadcn/lib/utils'
import { PinMarker } from './pin-marker'

const GHOST_PIN_COLOR = 'hsl(var(--muted-foreground))'

interface MapPinsLayerProps {
  pins: Array<MapPinWithItem>
  isPinGhost: (pin: MapPinWithItem) => boolean
  hoveredPinId?: Id<'mapPins'> | null
  draggingPinId?: Id<'mapPins'> | null
  moveModePinId?: Id<'mapPins'> | null
  interactive?: boolean
  onHover?: (pinId: Id<'mapPins'> | null) => void
  onClick?: (event: MouseEvent | KeyboardEvent, pin: MapPinWithItem) => void
  onContextMenu?: (event: MouseEvent, pin: MapPinWithItem) => void
  onDragStart?: (event: MouseEvent, pin: MapPinWithItem) => void
  className?: string
}

export const MapPinsLayer = forwardRef<HTMLDivElement, MapPinsLayerProps>(function MapPinsLayer(
  {
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
  },
  ref,
) {
  return (
    <div ref={ref} className={cn('absolute inset-0 pointer-events-none', className)}>
      {pins.map((pin) => (
        <MapPin
          key={pin._id}
          pin={pin}
          isGhost={isPinGhost(pin)}
          isHovered={hoveredPinId === pin._id}
          isDragging={draggingPinId === pin._id}
          isInMoveMode={moveModePinId === pin._id}
          interactive={interactive}
          onHover={onHover}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  )
})

function MapPin({
  pin,
  isGhost,
  isHovered,
  isDragging,
  isInMoveMode,
  interactive,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
}: {
  pin: MapPinWithItem
  isGhost: boolean
  isHovered: boolean
  isDragging: boolean
  isInMoveMode: boolean
  interactive: boolean
  onHover?: (pinId: Id<'mapPins'> | null) => void
  onClick?: (event: MouseEvent | KeyboardEvent, pin: MapPinWithItem) => void
  onContextMenu?: (event: MouseEvent, pin: MapPinWithItem) => void
  onDragStart?: (event: MouseEvent, pin: MapPinWithItem) => void
}) {
  const presentation = getMapPinPresentation(pin, isGhost)
  const hoverScale = interactive && isHovered && !isDragging ? 1.2 : 1

  return interactive ? (
    <InteractiveMapPin
      pin={pin}
      presentation={presentation}
      isHovered={isHovered}
      isDragging={isDragging}
      isHidden={presentation.isHidden}
      isInMoveMode={isInMoveMode}
      hoverScale={hoverScale}
      onHover={onHover}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
    />
  ) : (
    <MapPinContainer
      pin={pin}
      isHovered={isHovered}
      isDragging={isDragging}
      isHidden={presentation.isHidden}
    >
      <div
        className="transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${hoverScale})`,
          transformOrigin: 'bottom center',
        }}
      >
        <PinMarker color={presentation.color} icon={presentation.icon} />
      </div>
    </MapPinContainer>
  )
}

function InteractiveMapPin({
  pin,
  presentation,
  isHovered,
  isDragging,
  isHidden,
  isInMoveMode,
  hoverScale,
  onHover,
  onClick,
  onContextMenu,
  onDragStart,
}: {
  pin: MapPinWithItem
  presentation: MapPinPresentation
  isHovered: boolean
  isDragging: boolean
  isHidden: boolean
  isInMoveMode: boolean
  hoverScale: number
  onHover?: (pinId: Id<'mapPins'> | null) => void
  onClick?: (event: MouseEvent | KeyboardEvent, pin: MapPinWithItem) => void
  onContextMenu?: (event: MouseEvent, pin: MapPinWithItem) => void
  onDragStart?: (event: MouseEvent, pin: MapPinWithItem) => void
}) {
  return (
    <MapPinContainer
      pin={pin}
      isHovered={isHovered}
      isDragging={isDragging}
      isHidden={isHidden}
      ariaLabel={presentation.itemName}
      interactive={true}
      onMouseEnter={() => onHover?.(pin._id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={onClick ? (event) => onClick(event, pin) : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return
              }

              event.preventDefault()
              onClick(event, pin)
            }
          : undefined
      }
      onContextMenu={onContextMenu ? (event) => onContextMenu(event, pin) : undefined}
      onMouseDown={
        onDragStart
          ? (event) => {
              if (!event.ctrlKey && !event.metaKey && !isInMoveMode) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              onDragStart(event, pin)
            }
          : undefined
      }
    >
      <div
        className="transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${hoverScale})`,
          transformOrigin: 'bottom center',
        }}
      >
        <PinMarker color={presentation.color} icon={presentation.icon} />
      </div>

      <MapPinTooltip itemName={presentation.itemName} isVisible={isHovered && !isDragging} />
    </MapPinContainer>
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
      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-popover" />
    </div>
  )
}

function MapPinContainer({
  pin,
  isHovered,
  isDragging,
  isHidden,
  children,
  ariaLabel,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onKeyDown,
  onContextMenu,
  onMouseDown,
}: {
  pin: MapPinWithItem
  isHovered: boolean
  isDragging: boolean
  isHidden: boolean
  children: ReactNode
  ariaLabel?: string
  interactive?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void
  onMouseDown?: (event: MouseEvent<HTMLElement>) => void
}) {
  const className = cn(
    'absolute',
    interactive
      ? 'pointer-events-auto cursor-pointer border-0 bg-transparent p-0'
      : 'pointer-events-none',
    isHovered && !isDragging && 'z-20',
    isDragging && 'z-30 opacity-70',
    isHidden && !isDragging && 'opacity-60',
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
        data-pin-id={pin._id}
        aria-label={ariaLabel}
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onContextMenu={onContextMenu}
        onMouseDown={onMouseDown}
      >
        {children}
      </button>
    )
  }

  return (
    <div data-pin-id={pin._id} className={className} style={style}>
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
  const visibleItem = isGhost || pin.item === null ? undefined : pin.item
  const color = isGhost
    ? GHOST_PIN_COLOR
    : normalizeSidebarItemColorOrDefault(visibleItem?.color, DEFAULT_SIDEBAR_ITEM_COLOR)
  const isHidden = pin.visible !== true
  const baseName = isGhost ? '???' : (visibleItem?.name ?? '')

  return {
    color,
    icon: getSidebarItemIcon(visibleItem),
    itemName: isHidden ? `${baseName} (hidden)` : baseName,
    isHidden,
  }
}
