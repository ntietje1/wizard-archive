import { EditorContent } from '../components/editor-content'
import { EditorWorkspaceSurface } from '../components/editor-workspace-surface'
import { FileTopbar } from '../components/topbar/file-topbar'
import { TrashBanner } from '../components/deleted-item-banner'
import { RightSidebarContainer } from '../components/right-sidebar/right-sidebar-container'
import { liveRightSidebarPanelServices } from '../components/right-sidebar/live-right-sidebar-panel-source'
import { useLiveEditorWorkspaceSource } from '../workspace/use-live-editor-workspace-source'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import type { EditorWorkspaceSource } from '../workspace/editor-workspace-source'

export function EditorPage() {
  useSelectedItemSync()
  const workspaceSource = useLiveEditorWorkspaceSource()

  return (
    <EditorWorkspaceSurface
      topbar={<FileTopbar source={workspaceSource} />}
      banner={<EditorBanner source={workspaceSource} />}
      rightSidebar={
        <RightSidebarContainer
          item={workspaceSource.currentItem.item}
          panelServices={liveRightSidebarPanelServices}
          sidebar={workspaceSource.chrome.rightSidebar}
        />
      }
    >
      <EditorContent source={workspaceSource} />
    </EditorWorkspaceSurface>
  )
}

function EditorBanner({ source }: { source: EditorWorkspaceSource }) {
  const { item, isLoading } = source.currentItem
  if (isLoading || !item || !item.isTrashed) return null
  return <TrashBanner item={item} />
}
