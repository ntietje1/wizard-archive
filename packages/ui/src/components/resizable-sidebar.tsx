import { useRef } from 'react'
import type { ReactNode } from 'react'

const DEFAULT_MIN_WIDTH = 164
const DEFAULT_MAX_WIDTH = 600
const SNAP_CLOSED_THRESHOLD = 50
const ARROW_STEP = 10
const PAGE_STEP = 50

function computeWidths(
  rawWidth: number,
  fallbackContentWidth: number,
  minWidth: number,
  maxWidth: number,
  extraWidth: number,
) {
  const clamped = resolveSize(rawWidth, minWidth, maxWidth)
  const contentWidth = clamped > 0 ? clamped : fallbackContentWidth
  return {
    displayWidth: clamped,
    contentWidth,
    totalDisplay: clamped + extraWidth,
    totalContent: contentWidth + extraWidth,
  }
}

function resolveSize(rawSize: number, minWidth: number, maxWidth: number) {
  if (rawSize < SNAP_CLOSED_THRESHOLD) return 0
  return Math.min(maxWidth, Math.max(minWidth, rawSize))
}

type ResizableSidebarProps = {
  side: 'left' | 'right'
  size: number
  visible: boolean
  onSizeChange: (size: number) => void
  onVisibleChange: (visible: boolean) => void
  isLoaded: boolean
  minWidth?: number
  maxWidth?: number
  extraWidth?: number
  children: ReactNode
}

export function ResizableSidebar({
  side,
  size,
  visible,
  onSizeChange,
  onVisibleChange,
  isLoaded,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  extraWidth = 0,
  children,
}: ResizableSidebarProps) {
  const handleRef = useRef<HTMLButtonElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragWidthRef = useRef(size)
  const dragStateRef = useRef<{
    pointerId: number
    startWidth: number
    startX: number
  } | null>(null)

  const applyDraggedWidth = (rawWidth: number, fallbackContentWidth: number) => {
    const { totalDisplay, totalContent } = computeWidths(
      rawWidth,
      fallbackContentWidth,
      minWidth,
      maxWidth,
      extraWidth,
    )

    if (outerRef.current) outerRef.current.style.width = `${totalDisplay}px`
    if (innerRef.current) innerRef.current.style.width = `${totalContent}px`
    if (handleRef.current) {
      if (side === 'left') {
        handleRef.current.style.left = `${totalDisplay}px`
      } else {
        handleRef.current.style.right = `${totalDisplay}px`
      }
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!visible || !isLoaded) return
    if (e.button !== 0) return

    e.preventDefault()
    dragWidthRef.current = size
    dragStateRef.current = {
      pointerId: e.pointerId,
      startWidth: size,
      startX: e.clientX,
    }
    e.currentTarget.setPointerCapture(e.pointerId)

    handleRef.current?.classList.add('bg-primary')
    handleRef.current?.classList.remove('hover:bg-border')
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== e.pointerId) return

    const direction = side === 'left' ? 1 : -1
    const delta = (e.clientX - dragState.startX) * direction
    const rawWidth = dragState.startWidth + delta
    dragWidthRef.current = rawWidth
    applyDraggedWidth(rawWidth, dragState.startWidth)
  }

  const finishPointerDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== e.pointerId) return
    dragStateRef.current = null

    handleRef.current?.classList.remove('bg-primary')
    handleRef.current?.classList.add('hover:bg-border')

    const finalWidth = dragWidthRef.current
    const resolvedSize = resolveSize(finalWidth, minWidth, maxWidth)
    if (resolvedSize === 0) {
      onVisibleChange(false)
    } else {
      onSizeChange(resolvedSize)
    }

    applyDraggedWidth(finalWidth, dragState.startWidth)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!visible || !isLoaded) return

    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
    const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'

    let rawSize: number | null = null

    switch (e.key) {
      case grow:
        rawSize = size + ARROW_STEP
        break
      case shrink:
        rawSize = size <= minWidth ? SNAP_CLOSED_THRESHOLD - 1 : size - ARROW_STEP
        break
      case 'PageUp':
        rawSize = size + PAGE_STEP
        break
      case 'PageDown':
        rawSize = size <= minWidth ? SNAP_CLOSED_THRESHOLD - 1 : size - PAGE_STEP
        break
      case 'Home':
        rawSize = minWidth
        break
      case 'End':
        rawSize = maxWidth
        break
      default:
        return
    }

    e.preventDefault()

    const resolvedSize = resolveSize(rawSize, minWidth, maxWidth)
    if (resolvedSize === 0) {
      onVisibleChange(false)
    } else {
      onSizeChange(resolvedSize)
    }
  }

  const clampedSize = resolveSize(size, minWidth, maxWidth) || minWidth
  const contentPanelWidth = visible ? clampedSize : 0
  const totalDisplayWidth = contentPanelWidth + extraWidth
  const totalContentWidth = clampedSize + extraWidth

  const borderClass = side === 'left' ? 'border-r' : 'border-l'
  const handlePositionStyle =
    side === 'left' ? { left: totalDisplayWidth } : { right: totalDisplayWidth }

  return (
    <>
      <div
        ref={outerRef}
        className={`shrink-0 overflow-hidden ${borderClass}`}
        style={{ width: totalDisplayWidth, order: side === 'left' ? 0 : 2 }}
      >
        <div ref={innerRef} className="h-full" style={{ width: totalContentWidth }}>
          {children}
        </div>
      </div>
      <button
        type="button"
        role="slider"
        ref={handleRef}
        aria-label="Resize sidebar"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={maxWidth}
        aria-valuenow={visible ? clampedSize : 0}
        tabIndex={visible ? 0 : undefined}
        className={`absolute top-0 h-full w-1 -ml-0.5 z-10 touch-none appearance-none border-0 bg-transparent p-0 ${visible ? 'cursor-col-resize hover:bg-border hover:transition-colors hover:duration-100 ease-out focus-visible:bg-primary' : ''}`}
        style={handlePositionStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onKeyDown={handleKeyDown}
      />
    </>
  )
}
