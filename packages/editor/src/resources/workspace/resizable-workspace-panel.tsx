import { useEffect, useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import {
  MAX_WORKSPACE_PANEL_SIZE,
  MIN_WORKSPACE_PANEL_SIZE,
  normalizeWorkspacePanelGeometry,
} from '../workspace-panel-geometry'

const SNAP_CLOSED_THRESHOLD = 50

export function ResizableWorkspacePanel({
  children,
  onCommit,
  onClose,
  panel,
  size,
}: {
  children: ReactNode
  onCommit: (size: number) => void
  onClose: () => void
  panel: 'left' | 'right'
  size: number
}) {
  const panelElement = useRef<HTMLDivElement>(null)
  const contentElement = useRef<HTMLDivElement>(null)
  const activeResize = useRef<AbortController | null>(null)
  const draggedSize = useRef(size)
  useEffect(
    () => () => {
      activeResize.current?.abort()
    },
    [],
  )
  const resize = (requestedSize: number, fallbackContentSize = size) => {
    const snappedClosed = requestedSize < SNAP_CLOSED_THRESHOLD
    const bounded = normalizeWorkspacePanelGeometry({ [panel]: requestedSize })[panel]
    const displayedSize = snappedClosed ? 0 : bounded
    if (panelElement.current) panelElement.current.style.width = `${displayedSize}px`
    if (contentElement.current) {
      contentElement.current.style.width = `${snappedClosed ? fallbackContentSize : bounded}px`
    }
    draggedSize.current = requestedSize
    return { bounded, snappedClosed }
  }

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startSize = panelElement.current?.getBoundingClientRect().width ?? size
    activeResize.current?.abort()
    const controller = new AbortController()
    activeResize.current = controller
    const resizeHandle = event.currentTarget
    resizeHandle.setAttribute('data-resizing', 'true')
    resize(startSize, startSize)
    const move = (moveEvent: globalThis.PointerEvent) => {
      const delta = moveEvent.clientX - startX
      resize(startSize + (panel === 'left' ? delta : -delta), startSize)
    }
    const finish = () => {
      controller.abort()
      if (activeResize.current === controller) activeResize.current = null
      resizeHandle.removeAttribute('data-resizing')
      const result = resize(draggedSize.current, startSize)
      if (result.snappedClosed) onClose()
      else onCommit(result.bounded)
    }
    window.addEventListener('pointermove', move, { signal: controller.signal })
    window.addEventListener('pointerup', finish, { signal: controller.signal })
    window.addEventListener('pointercancel', finish, { signal: controller.signal })
  }

  return (
    <div
      ref={panelElement}
      className={`relative z-20 h-full min-h-0 shrink-0 max-md:absolute max-md:inset-y-0 ${panel === 'left' ? 'max-md:left-0' : 'max-md:right-0'}`}
      style={{ width: size }}
    >
      <div className="h-full overflow-hidden">
        <div ref={contentElement} className="h-full" style={{ width: size }}>
          {children}
        </div>
      </div>
      <div
        role="separator"
        aria-label={`Resize ${panel} sidebar`}
        aria-orientation="vertical"
        aria-valuemax={MAX_WORKSPACE_PANEL_SIZE}
        aria-valuemin={MIN_WORKSPACE_PANEL_SIZE}
        aria-valuenow={size}
        className={`allow-motion absolute inset-y-0 z-30 w-px cursor-col-resize touch-none bg-border transition-[width,background-color] duration-100 ease-out hover:w-1 hover:bg-border focus-visible:w-1 focus-visible:bg-primary focus-visible:outline-none data-[resizing=true]:w-1 data-[resizing=true]:bg-primary ${panel === 'left' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          const direction = event.key === 'ArrowRight' ? 1 : -1
          const currentSize = panelElement.current?.getBoundingClientRect().width ?? size
          const next = resize(currentSize + direction * (panel === 'left' ? 10 : -10))
          if (next.snappedClosed) onClose()
          else onCommit(next.bounded)
        }}
        onPointerDown={startResize}
      />
    </div>
  )
}
