import { useEffect, useRef } from 'react'

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
  const clamped =
    rawWidth < SNAP_CLOSED_THRESHOLD
      ? 0
      : Math.min(maxWidth, Math.max(minWidth, rawWidth))
  const contentWidth = clamped > 0 ? clamped : fallbackContentWidth
  return {
    displayWidth: clamped,
    contentWidth,
    totalDisplay: clamped + extraWidth,
    totalContent: contentWidth + extraWidth,
  }
}

export type ResizableSidebarProps = {
  side: 'left' | 'right'
  size: number
  visible: boolean
  onSizeChange: (size: number) => void
  onVisibleChange: (visible: boolean) => void
  isLoaded: boolean
  minWidth?: number
  maxWidth?: number
  extraWidth?: number
  children: React.ReactNode
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
  const handleRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragWidthRef = useRef(size)
  const dragListenersRef = useRef<{
    move: (e: MouseEvent) => void
    up: (e: MouseEvent) => void
  } | null>(null)

  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        document.removeEventListener('mousemove', dragListenersRef.current.move)
        document.removeEventListener('mouseup', dragListenersRef.current.up)
        dragListenersRef.current = null
      }
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!visible || !isLoaded) return

    e.preventDefault()
    const startX = e.clientX
    const startWidth = size
    dragWidthRef.current = startWidth
    const direction = side === 'left' ? 1 : -1

    handleRef.current?.classList.add('bg-primary')
    handleRef.current?.classList.remove('hover:bg-border')

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = (moveEvent.clientX - startX) * direction
      const rawWidth = startWidth + delta
      dragWidthRef.current = rawWidth

      const { totalDisplay, totalContent } = computeWidths(
        rawWidth,
        startWidth,
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

    const handleMouseUp = () => {
      handleRef.current?.classList.remove('bg-primary')
      handleRef.current?.classList.add('hover:bg-border')
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      dragListenersRef.current = null

      const finalWidth = dragWidthRef.current

      if (finalWidth < SNAP_CLOSED_THRESHOLD) {
        onVisibleChange(false)
      } else {
        onSizeChange(Math.min(maxWidth, Math.max(minWidth, finalWidth)))
      }

      const { totalDisplay, totalContent } = computeWidths(
        finalWidth,
        startWidth,
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

    dragListenersRef.current = { move: handleMouseMove, up: handleMouseUp }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!visible || !isLoaded) return

    const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
    const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'

    let newSize: number | null = null

    switch (e.key) {
      case grow:
        newSize = Math.min(maxWidth, size + ARROW_STEP)
        break
      case shrink:
        newSize = size - ARROW_STEP
        break
      case 'PageUp':
        newSize = Math.min(maxWidth, size + PAGE_STEP)
        break
      case 'PageDown':
        newSize = size - PAGE_STEP
        break
      case 'Home':
        newSize = maxWidth
        break
      case 'End':
        newSize = minWidth
        break
      default:
        return
    }

    e.preventDefault()

    if (newSize < SNAP_CLOSED_THRESHOLD) {
      onVisibleChange(false)
    } else {
      onSizeChange(Math.min(maxWidth, Math.max(minWidth, newSize)))
    }
  }

  const clampedSize = Math.min(maxWidth, Math.max(minWidth, size))
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
        <div
          ref={innerRef}
          className="h-full"
          style={{ width: totalContentWidth }}
        >
          {children}
        </div>
      </div>
      <div
        ref={handleRef}
        role="separator"
        aria-valuenow={visible ? clampedSize : undefined}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={visible ? 0 : undefined}
        className={`absolute top-0 h-full w-1 -ml-0.5 z-10 ${visible ? 'cursor-col-resize hover:bg-border hover:transition-colors hover:duration-100 ease-out focus-visible:bg-primary' : ''}`}
        style={handlePositionStyle}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
      />
    </>
  )
}
