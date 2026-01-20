import { useCallback, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { SessionPanel } from '../editor/session-panel/session-panel'
import { SidebarHeader } from '../editor/sidebar-header/sidebar-header'
import { FileSidebar } from './sidebar'
import {
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import usePersistedState from '~/hooks/usePersistedState'
import { useCampaign } from '~/hooks/useCampaign'

const SIDEBAR_DEFAULT_WIDTH = 280
const SIDEBAR_MIN_WIDTH = 80

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarExpanded, setIsSidebarExpanded } = useFileSidebar()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    campaignId ? `sidebar-width-${campaignId}` : null,
    SIDEBAR_DEFAULT_WIDTH,
  )

  const [isResizing, setIsResizing] = useState(false)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const [willSnapClosed, setWillSnapClosed] = useState(false)
  const [willSnapOpen, setWillSnapOpen] = useState(false)
  const dragWidthRef = useRef<number>(0)
  const wasExpandedRef = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)

      const startX = e.clientX
      const wasExpanded = isSidebarExpanded
      wasExpandedRef.current = wasExpanded
      const startWidth = wasExpanded ? sidebarWidth : 0
      dragWidthRef.current = startWidth

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX
        const newWidth = Math.max(0, startWidth + delta)
        dragWidthRef.current = newWidth
        setDragWidth(newWidth)

        // Update snap indicators
        if (wasExpandedRef.current) {
          // From expanded: will snap closed if below min width
          setWillSnapClosed(newWidth < SIDEBAR_MIN_WIDTH)
          setWillSnapOpen(false)
        } else {
          // From collapsed: will snap open if any width > 0
          setWillSnapOpen(newWidth > 0 && newWidth < SIDEBAR_MIN_WIDTH)
          setWillSnapClosed(false)
        }
      }

      const handleMouseUp = () => {
        const finalWidth = dragWidthRef.current

        if (wasExpandedRef.current) {
          // From expanded: snap closed if below min width
          if (finalWidth < SIDEBAR_MIN_WIDTH) {
            setIsSidebarExpanded(false)
          } else {
            setSidebarWidth(finalWidth)
          }
        } else {
          // From collapsed: snap open to min width if any drag
          if (finalWidth > 0) {
            setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, finalWidth))
            setIsSidebarExpanded(true)
          }
        }

        setDragWidth(null)
        setIsResizing(false)
        setWillSnapClosed(false)
        setWillSnapOpen(false)
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [isSidebarExpanded, sidebarWidth, setIsSidebarExpanded, setSidebarWidth],
  )

  // Use drag width while resizing, otherwise use saved width or 0
  const displayWidth =
    dragWidth !== null ? dragWidth : isSidebarExpanded ? sidebarWidth : 0

  return (
    <div ref={containerRef} className="flex flex-1 min-h-0 min-w-0">
      <motion.div
        className="shrink-0 overflow-hidden border-r bg-background"
        initial={false}
        animate={{
          width: displayWidth,
          borderRightWidth: displayWidth > 0 ? 1 : 0,
        }}
        transition={{ duration: isResizing ? 0 : 0.2, ease: 'easeInOut' }}
      >
        <div
          className="h-full flex flex-col"
          style={{ width: isResizing ? displayWidth : sidebarWidth }}
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
      </motion.div>

      {/* Custom resize handle */}
      <div
        className={`w-1 shrink-0 cursor-col-resize ${
          willSnapClosed || willSnapOpen
            ? 'bg-purple-500/50'
            : isResizing
              ? 'bg-primary/30'
              : 'hover:bg-primary/20 active:bg-primary/30'
        }`}
        onMouseDown={handleMouseDown}
      />

      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
