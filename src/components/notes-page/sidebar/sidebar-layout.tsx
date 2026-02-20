import { memo, useCallback, useRef, useState } from 'react'
import { SessionPanel } from '../editor/session-panel/session-panel'
import { SidebarHeader } from '../editor/sidebar-header/sidebar-header'
import { FileSidebar } from './sidebar'
import {
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useSidebarLayout } from '~/hooks/useSidebarLayout'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { Button } from '~/components/shadcn/ui/button'
import { Plus } from '~/lib/icons'

const SIDEBAR_MIN_WIDTH = 160
const SNAP_CLOSED_THRESHOLD = 50

const SidebarContent = memo(function SidebarContent() {
  const { clearEditorContent } = useEditorNavigationContext()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
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
          <div className="shrink-0 p-2 border-t border-b">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={clearEditorContent}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
          <SessionPanel />
        </ResizablePanelGroup>
      </EditorContextMenu>
    </div>
  )
})

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const {
    isSidebarExpanded,
    setIsSidebarExpanded,
    sidebarWidth,
    setSidebarWidth,
    isEditorSettingsLoaded,
  } = useSidebarLayout()

  const handleRef = useRef<HTMLDivElement>(null)
  const dragWidthRef = useRef(sidebarWidth)
  const [dragDisplayWidth, setDragDisplayWidth] = useState<number | null>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isSidebarExpanded || !isEditorSettingsLoaded) return

      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidth
      dragWidthRef.current = startWidth

      handleRef.current?.classList.add('bg-primary/30')

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX
        const rawWidth = startWidth + delta
        dragWidthRef.current = rawWidth

        if (rawWidth < SNAP_CLOSED_THRESHOLD) {
          setDragDisplayWidth(0)
        } else {
          setDragDisplayWidth(Math.max(SIDEBAR_MIN_WIDTH, rawWidth))
        }
      }

      const handleMouseUp = () => {
        handleRef.current?.classList.remove('bg-primary/30')
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)

        const finalWidth = dragWidthRef.current

        if (finalWidth < SNAP_CLOSED_THRESHOLD) {
          setIsSidebarExpanded(false)
        } else {
          setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, finalWidth))
        }

        setDragDisplayWidth(null)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [
      isSidebarExpanded,
      isEditorSettingsLoaded,
      sidebarWidth,
      setSidebarWidth,
      setIsSidebarExpanded,
    ],
  )

  // During drag, use dragDisplayWidth; otherwise use actual state
  const displayWidth =
    dragDisplayWidth ?? (isSidebarExpanded ? sidebarWidth : 0)
  const contentWidth =
    dragDisplayWidth !== null && dragDisplayWidth > 0
      ? dragDisplayWidth
      : sidebarWidth

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <div className="shrink-0 overflow-hidden" style={{ width: displayWidth }}>
        <div
          className="h-full flex flex-col border-r bg-background"
          style={{ width: contentWidth }}
        >
          <SidebarContent />
        </div>
      </div>

      {/* Resize handle */}
      <div
        ref={handleRef}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30"
        onMouseDown={handleMouseDown}
        onMouseEnter={(e) => {
          e.currentTarget.style.transitionProperty = 'background-color'
          e.currentTarget.style.transitionDuration = '200ms'
          e.currentTarget.style.transitionTimingFunction =
            'cubic-bezier(0.55, 0, 1, 0.45)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transitionProperty = 'none'
          e.currentTarget.style.transitionDuration = ''
          e.currentTarget.style.transitionTimingFunction = ''
        }}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
