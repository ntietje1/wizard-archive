import { memo, useRef, useState } from 'react'
import { FileSidebar } from './sidebar'
import { NewButton } from './new-button'
import { TrashButton } from './trash-button'
import { SidebarHeader } from '~/features/sidebar/components/sidebar-header/sidebar-header'
import { SessionPanel } from '~/features/sidebar/components/session-panel/session-panel'
import {
  ResizablePanel,
  ResizablePanelGroup,
} from '~/features/shadcn/components/resizable'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useSidebarLayout } from '~/features/sidebar/hooks/useSidebarLayout'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const SIDEBAR_MIN_WIDTH = 160
const SNAP_CLOSED_THRESHOLD = 50

const SidebarContent = memo(function SidebarContent() {
  const { isDm } = useCampaign()

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
          <div className="shrink-0 p-1 border-t">
            {isDm && <NewButton />}
            <TrashButton />
          </div>
          <div className="shrink-0 border-t" />
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
    isUserPreferencesLoaded,
  } = useSidebarLayout()

  const handleRef = useRef<HTMLDivElement>(null)
  const dragWidthRef = useRef(sidebarWidth)
  const [dragDisplayWidth, setDragDisplayWidth] = useState<number | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSidebarExpanded || !isUserPreferencesLoaded) return

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
  }

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
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
