import { memo, useRef, useState } from 'react'
import { FileSidebar } from './sidebar'
import { NewButton } from './new-button'
import { TrashButton } from './trash-button'
import { SidebarWrapper } from './sidebar-toolbar/sidebar-toolbar'
import { NAV_COLUMN_WIDTH } from './sidebar-toolbar/constants'
import { CampaignPanel } from '~/features/sidebar/components/campaign-panel/campaign-panel'
import {
  ResizablePanel,
  ResizablePanelGroup,
} from '~/features/shadcn/components/resizable'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useSidebarLayout } from '~/features/sidebar/hooks/useSidebarLayout'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

const SIDEBAR_MIN_WIDTH = 164
const SNAP_CLOSED_THRESHOLD = 50

const SidebarContent = memo(function SidebarContent() {
  const { isDm } = useCampaign()

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
      <EditorContextMenu
        viewContext="sidebar"
        className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden"
      >
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
          <CampaignPanel />
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

    handleRef.current?.classList.add('bg-primary')
    handleRef.current?.classList.remove('hover:bg-border')

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
      handleRef.current?.classList.remove('bg-primary')
      handleRef.current?.classList.add('hover:bg-border')
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

  const contentPanelWidth =
    dragDisplayWidth ?? (isSidebarExpanded ? sidebarWidth : 0)
  const innerContentWidth =
    dragDisplayWidth !== null && dragDisplayWidth > 0
      ? dragDisplayWidth
      : sidebarWidth

  const totalDisplayWidth = contentPanelWidth + NAV_COLUMN_WIDTH
  const totalContentWidth = innerContentWidth + NAV_COLUMN_WIDTH

  return (
    <div className="relative flex flex-1 min-h-0 min-w-0">
      <div
        className="shrink-0 overflow-hidden border-r"
        style={{ width: totalDisplayWidth }}
      >
        <div className="h-full" style={{ width: totalContentWidth }}>
          <SidebarWrapper>
            <SidebarContent />
          </SidebarWrapper>
        </div>
      </div>
      <div
        ref={handleRef}
        className={`absolute top-0 h-full w-1 -ml-0.5 z-10 ${isSidebarExpanded ? 'cursor-col-resize hover:bg-border hover:transition-colors hover:duration-100 ease-out' : ''}`}
        style={{ left: totalDisplayWidth }}
        onMouseDown={handleMouseDown}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
