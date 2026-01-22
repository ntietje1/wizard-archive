import { useCallback, useEffect, useRef, useState } from 'react'
import { SessionPanel } from '../editor/session-panel/session-panel'
import { SidebarHeader } from '../editor/sidebar-header/sidebar-header'
import { FileSidebar } from './sidebar'
import {
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useFileSidebar } from '~/hooks/useFileSidebar'

const SIDEBAR_MIN_WIDTH = 120
const SNAP_CLOSED_THRESHOLD = 10

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const {
    isSidebarExpanded,
    setIsSidebarExpanded,
    sidebarWidth,
    setSidebarWidth,
    isEditorSettingsLoaded,
  } = useFileSidebar()

  const [skipAnimation, setSkipAnimation] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const shouldAnimate = hasMounted && isEditorSettingsLoaded && !skipAnimation
  const dragWidthRef = useRef<number>(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isSidebarExpanded || !isEditorSettingsLoaded) return

      e.preventDefault()

      const startX = e.clientX
      const startWidth = sidebarWidth
      dragWidthRef.current = startWidth

      // Disable transitions for resize mode
      if (wrapperRef.current) {
        wrapperRef.current.style.transition = 'none'
      }
      if (sidebarRef.current) {
        sidebarRef.current.style.transition = 'none'
      }
      if (handleRef.current) {
        handleRef.current.classList.add('bg-primary/30')
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        const rawWidth = Math.max(0, startWidth + delta)
        dragWidthRef.current = rawWidth

        let displayWidth: number
        if (rawWidth < SNAP_CLOSED_THRESHOLD) {
          displayWidth = 0
        } else if (rawWidth < SIDEBAR_MIN_WIDTH) {
          displayWidth = SIDEBAR_MIN_WIDTH
        } else {
          displayWidth = rawWidth
        }

        // Update both wrapper (visible area) and sidebar (content width)
        if (wrapperRef.current) {
          wrapperRef.current.style.width = `${displayWidth}px`
        }
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${displayWidth}px`
        }
      }

      const handleMouseUp = () => {
        const finalWidth = dragWidthRef.current

        // Disable animation for this update
        setSkipAnimation(true)

        if (finalWidth < SNAP_CLOSED_THRESHOLD) {
          setIsSidebarExpanded(false)
        } else {
          setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, finalWidth))
        }

        // Clear inline styles after React has rendered with skipAnimation=true
        requestAnimationFrame(() => {
          if (wrapperRef.current) {
            wrapperRef.current.style.transition = ''
            wrapperRef.current.style.width = ''
          }
          if (sidebarRef.current) {
            sidebarRef.current.style.transition = ''
            sidebarRef.current.style.width = ''
          }
          if (handleRef.current) {
            handleRef.current.classList.remove('bg-primary/30')
          }
          // Re-enable animation for button-triggered collapse/expand
          setSkipAnimation(false)
        })

        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isSidebarExpanded, isEditorSettingsLoaded, sidebarWidth, setIsSidebarExpanded, setSidebarWidth],
  )

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      {/* Wrapper that animates width - contains no reflowing content */}
      <div
        ref={wrapperRef}
        className="shrink-0 overflow-hidden"
        style={{
          width: isSidebarExpanded ? sidebarWidth : 0,
          transition: shouldAnimate ? 'width 0.2s ease-in-out' : 'none',
          willChange: shouldAnimate ? 'width' : 'auto',
        }}
      >
        {/* Inner container uses transform for smooth animation - no layout recalc */}
        <div
          ref={sidebarRef}
          className="h-full flex flex-col border-r bg-background"
          style={{
            width: sidebarWidth,
            transform: isSidebarExpanded ? 'translateX(0)' : `translateX(-${sidebarWidth}px)`,
            transition: shouldAnimate ? 'transform 0.2s ease-in-out' : 'none',
            willChange: shouldAnimate ? 'transform' : 'auto',
          }}
        >
          <EditorContextMenu
            viewContext="sidebar"
            className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden"
          >
            <SidebarHeader />
            <ResizablePanelGroup
              direction="vertical"
              className="flex-1"
              autoSaveId="notes-sidebar-layout-vertical"
            >
              <ResizablePanel
                defaultSize={75}
                minSize={50}
                className="flex flex-col min-h-0 min-w-0"
              >
                <FileSidebar />
              </ResizablePanel>
              <div className="h-px w-full bg-border" />
              <SessionPanel />
            </ResizablePanelGroup>
          </EditorContextMenu>
        </div>
      </div>

      {/* Custom resize handle - always rendered for hydration consistency, interactive styles added after mount */}
      <div
        ref={handleRef}
        className={`w-1 shrink-0 ${
          hasMounted && isEditorSettingsLoaded && isSidebarExpanded
            ? 'cursor-col-resize hover:bg-primary/20 active:bg-primary/30'
            : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
