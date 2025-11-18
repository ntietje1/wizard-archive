import { useRef, useCallback, useState, useEffect } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import type { Location } from 'convex/locations/types'
import { getTagColor } from '~/hooks/useTags'
import { getCategoryIcon } from '~/lib/category-icons'
import { cn } from '~/lib/utils'

interface Pin {
  _id: Id<'mapPins'>
  x: number
  y: number
  locationId: Id<'locations'>
}

interface PinPosition {
  x: number
  y: number
}

interface MapPinProps {
  pin: Pin
  location: Location
  draggable: boolean
  onDragStart: () => void
  onDrag: (x: number, y: number) => void
  onDragEnd: (x: number, y: number) => void
  onContextMenu: (e: React.MouseEvent) => void
  imageRef: React.RefObject<globalThis.HTMLImageElement | null>
}

export function MapPin({
  pin,
  location,
  draggable,
  onDragStart,
  onDrag,
  onDragEnd,
  onContextMenu,
  imageRef,
}: MapPinProps) {
  const pinRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartPos = useRef<PinPosition | null>(null)
  const initialPinPos = useRef<PinPosition | null>(null)

  const color = getTagColor(location)
  const Icon = getCategoryIcon(location.category?.iconName)

  const getPercentageFromPixel = useCallback(
    (clientX: number, clientY: number): PinPosition => {
      if (!imageRef.current) return { x: pin.x, y: pin.y }

      const rect = imageRef.current.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100

      return {
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
      }
    },
    [pin.x, pin.y, imageRef],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!draggable) return

      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      const startPercent = getPercentageFromPixel(e.clientX, e.clientY)
      dragStartPos.current = startPercent
      initialPinPos.current = { x: pin.x, y: pin.y }
      onDragStart()
    },
    [draggable, pin.x, pin.y, onDragStart, getPercentageFromPixel],
  )

  useEffect(() => {
    if (!isDragging || !draggable) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!dragStartPos.current || !initialPinPos.current || !imageRef.current) return

      const currentPercent = getPercentageFromPixel(e.clientX, e.clientY)
      const deltaX = currentPercent.x - dragStartPos.current.x
      const deltaY = currentPercent.y - dragStartPos.current.y

      const newX = Math.max(0, Math.min(100, initialPinPos.current.x + deltaX))
      const newY = Math.max(0, Math.min(100, initialPinPos.current.y + deltaY))

      onDrag(newX, newY)
    }

    const handleMouseUp = (e: globalThis.MouseEvent) => {
      if (!dragStartPos.current || !initialPinPos.current || !imageRef.current) return

      const currentPercent = getPercentageFromPixel(e.clientX, e.clientY)
      const deltaX = currentPercent.x - dragStartPos.current.x
      const deltaY = currentPercent.y - dragStartPos.current.y

      const newX = Math.max(0, Math.min(100, initialPinPos.current.x + deltaX))
      const newY = Math.max(0, Math.min(100, initialPinPos.current.y + deltaY))

      setIsDragging(false)
      dragStartPos.current = null
      initialPinPos.current = null
      onDragEnd(newX, newY)
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: false })
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, draggable, onDrag, onDragEnd, imageRef, getPercentageFromPixel])

  return (
    <div
      ref={pinRef}
      className={cn(
        'absolute pointer-events-auto',
        draggable && 'cursor-move',
        isDragging && 'z-[100]',
      )}
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
    >
      <div
        className="rounded-full p-1.5 shadow-lg border-2 border-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>
      {draggable && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          Drag to move
        </div>
      )}
    </div>
  )
}
