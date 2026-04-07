import { useRef } from 'react'

const DEFAULT_MIN_WIDTH = 164
const SNAP_CLOSED_THRESHOLD = 50

function computeWidths(
  rawWidth: number,
  fallbackContentWidth: number,
  minWidth: number,
  extraWidth: number,
) {
  const displayWidth =
    rawWidth < SNAP_CLOSED_THRESHOLD ? 0 : Math.max(minWidth, rawWidth)
  const contentWidth = displayWidth > 0 ? displayWidth : fallbackContentWidth
  return {
    displayWidth,
    contentWidth,
    totalDisplay: displayWidth + extraWidth,
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
  extraWidth = 0,
  children,
}: ResizableSidebarProps) {
  const handleRef = useRef<HTMLDivElement>(null)
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const dragWidthRef = useRef(size)

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

      const finalWidth = dragWidthRef.current

      if (finalWidth < SNAP_CLOSED_THRESHOLD) {
        onVisibleChange(false)
      } else {
        onSizeChange(Math.max(minWidth, finalWidth))
      }

      const displayWidth =
        finalWidth < SNAP_CLOSED_THRESHOLD ? 0 : Math.max(minWidth, finalWidth)
      const contentWidth = displayWidth > 0 ? displayWidth : startWidth
      const totalDisplay = displayWidth + extraWidth
      const totalContent = contentWidth + extraWidth

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

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const contentPanelWidth = visible ? size : 0
  const totalDisplayWidth = contentPanelWidth + extraWidth
  const totalContentWidth = size + extraWidth

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
        className={`absolute top-0 h-full w-1 -ml-0.5 z-10 ${visible ? 'cursor-col-resize hover:bg-border hover:transition-colors hover:duration-100 ease-out' : ''}`}
        style={handlePositionStyle}
        onMouseDown={handleMouseDown}
      />
    </>
  )
}
