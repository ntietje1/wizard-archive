import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { SidebarHeader } from '../editor/sidebar-header/sidebar-header'
import { SessionPanel } from '../editor/session-panel/session-panel'
import { FileSidebar } from './sidebar'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { SidebarContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'
import { MapViewProvider } from '~/contexts/MapViewContext'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { isGameMap } from '~/lib/sidebar-item-utils'

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  // Check if viewing a map and provide context
  const { item } = useCurrentItem()
  const map = isGameMap(item) ? item : null
  const mapId = map?._id

  const pinsQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapPins, mapId ? { mapId } : 'skip'),
  )
  const pins = pinsQuery.data || []

  const content = (
    <div className="flex flex-1 min-h-0 min-w-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-w-0"
        autoSaveId="notes-sidebar-layout"
      >
        <ResizablePanel
          defaultSize={10}
          minSize={10}
          className="flex flex-col min-w-56"
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
              <SidebarContextMenu className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
                <SidebarHeader />
                <FileSidebar />
              </SidebarContextMenu>
            </ResizablePanel>
            <div className="h-px w-full bg-border" />
            <SessionPanel />
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={80}
          minSize={25}
          className="flex flex-col min-h-0 min-w-0"
        >
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )

  // Wrap with MapViewProvider if viewing a map
  if (map) {
    return (
      <MapViewProvider map={map} pins={pins}>
        {content}
      </MapViewProvider>
    )
  }

  return content
}
