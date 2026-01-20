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
const SIDEBAR_MIN_WIDTH = 120
const SNAP_CLOSED_THRESHOLD = 10

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarExpanded, setIsSidebarExpanded } = useFileSidebar()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const [sidebarWidth, setSidebarWidth] = usePersistedState<number>(
    campaignId ? `sidebar-width-${campaignId}` : null,
    SIDEBAR_DEFAULT_WIDTH,
  )

  const [skipAnimation, setSkipAnimation] = useState(false)
  const dragWidthRef = useRef<number>(0)
  const wasExpandedRef = useRef<boolean>(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()

      const startX = e.clientX
      const wasExpanded = isSidebarExpanded
      wasExpandedRef.current = wasExpanded
      const startWidth = wasExpanded ? sidebarWidth : 0
      dragWidthRef.current = startWidth

      // Apply immediate styles for resize mode
      if (sidebarRef.current) {
        sidebarRef.current.style.transition = 'none'
      }
      if (handleRef.current) {
        handleRef.current.classList.add('bg-primary/30')
      }

      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - startX
        const rawWidth = Math.max(0, startWidth + delta)
        dragWidthRef.current = rawWidth

        let displayWidth: number
        if (wasExpandedRef.current) {
          if (rawWidth < SNAP_CLOSED_THRESHOLD) {
            displayWidth = 0
          } else if (rawWidth < SIDEBAR_MIN_WIDTH) {
            displayWidth = SIDEBAR_MIN_WIDTH
          } else {
            displayWidth = rawWidth
          }
        } else {
          if (rawWidth > 0) {
            displayWidth = Math.max(SIDEBAR_MIN_WIDTH, rawWidth)
          } else {
            displayWidth = 0
          }
        }

        // Direct DOM manipulation - no React state updates
        if (sidebarRef.current) {
          sidebarRef.current.style.width = `${displayWidth}px`
          sidebarRef.current.style.borderRightWidth = displayWidth > 0 ? '1px' : '0px'
        }
        if (innerRef.current) {
          innerRef.current.style.width = `${displayWidth}px`
        }
      }

      const handleMouseUp = () => {
        const finalWidth = dragWidthRef.current

        // Disable animation for this update
        setSkipAnimation(true)

        if (wasExpandedRef.current) {
          if (finalWidth < SNAP_CLOSED_THRESHOLD) {
            setIsSidebarExpanded(false)
          } else {
            setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, finalWidth))
          }
        } else {
          if (finalWidth > 0) {
            setSidebarWidth(Math.max(SIDEBAR_MIN_WIDTH, finalWidth))
            setIsSidebarExpanded(true)
          }
        }

        // Clear inline styles after React has rendered with skipAnimation=true
        requestAnimationFrame(() => {
          if (sidebarRef.current) {
            sidebarRef.current.style.transition = ''
            sidebarRef.current.style.width = ''
            sidebarRef.current.style.borderRightWidth = ''
          }
          if (innerRef.current) {
            innerRef.current.style.width = ''
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
    [isSidebarExpanded, sidebarWidth, setIsSidebarExpanded, setSidebarWidth],
  )

  const displayWidth = isSidebarExpanded ? sidebarWidth : 0

  return (
    <div className="flex flex-1 min-h-0 min-w-0">
      <motion.div
        ref={sidebarRef}
        className="shrink-0 overflow-hidden border-r bg-background"
        initial={false}
        animate={{
          width: displayWidth,
          borderRightWidth: displayWidth > 0 ? 1 : 0,
        }}
        transition={{ duration: skipAnimation ? 0 : 0.2, ease: 'easeInOut' }}
      >
        <div
          ref={innerRef}
          className="h-full flex flex-col"
          style={{ width: sidebarWidth }}
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
        ref={handleRef}
        className="w-1 shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/30"
        onMouseDown={handleMouseDown}
      />

      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
