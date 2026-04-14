import { FileSidebar } from './sidebar'
import { NewButton } from './new-button'
import { TrashButton } from './trash-button'
import { SidebarWrapper } from './sidebar-toolbar/sidebar-toolbar'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
  NAV_COLUMN_WIDTH,
} from './sidebar-toolbar/constants'
import { ResizableSidebar } from './resizable-sidebar'
import type { PanelPreference } from 'convex/userPreferences/types'
import { CampaignPanel } from '~/features/sidebar/components/campaign-panel/campaign-panel'
import { ResizablePanel, ResizablePanelGroup } from '~/features/shadcn/components/resizable'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'

function SidebarContent() {
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
          <ResizablePanel defaultSize={75} minSize={50} className="flex flex-col min-h-0 min-w-0">
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
}

export function SidebarLayout({
  children,
  initialPanel,
}: {
  children: React.ReactNode
  initialPanel: PanelPreference | null
}) {
  const panelState = usePanelPreference(
    LEFT_SIDEBAR_PANEL_ID,
    LEFT_SIDEBAR_DEFAULTS,
    initialPanel ?? undefined,
  )

  return (
    <div className="relative flex flex-1 min-h-0 min-w-0">
      <ResizableSidebar
        side="left"
        size={panelState.size}
        visible={panelState.visible}
        onSizeChange={panelState.setSize}
        onVisibleChange={panelState.setVisible}
        isLoaded={panelState.isLoaded}
        extraWidth={NAV_COLUMN_WIDTH}
      >
        <nav aria-label="Sidebar" className="h-full">
          <SidebarWrapper>
            <SidebarContent />
          </SidebarWrapper>
        </nav>
      </ResizableSidebar>

      <div className="flex flex-col flex-1 min-h-0 min-w-0">{children}</div>
    </div>
  )
}
