import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { FileSidebar } from './sidebar'
import { SidebarHeader } from '../editor/sidebar-header/sidebar-header'
import { SessionPanel } from '../editor/session-panel/session-panel'

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0">
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1"
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
              className="flex flex-col min-h-0"
            >
              <SidebarHeader />
              <FileSidebar />
            </ResizablePanel>
            <div className="h-px w-full bg-border" />
            <SessionPanel />
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={80} minSize={25} className="flex flex-col min-h-0">
          {children}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

