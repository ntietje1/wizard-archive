import { useEffect, useRef } from 'react'
import { EditorContent } from '../components/editor-content'
import { EditorWorkspaceSurface } from '../components/editor-workspace-surface'
import { FileTopbar } from '../components/topbar/file-topbar'
import { TrashBanner } from '../components/deleted-item-banner'
import { RightSidebarContainer } from '../components/right-sidebar/right-sidebar-container'
import { liveRightSidebarPanelServices } from '../components/right-sidebar/live-right-sidebar-panel-source'
import { RIGHT_SIDEBAR_CONTENT } from '../chrome/right-sidebar-content'
import { useRightSidebar } from '../hooks/useRightSidebar'
import { useLiveEditorWorkspaceSource } from '../workspace/use-live-editor-workspace-source'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import type { EditorWorkspaceSource } from '../workspace/editor-workspace-source'

export function EditorPage() {
  useSelectedItemSync()
  const workspaceSource = useLiveEditorWorkspaceSource()
  const currentItem = workspaceSource.content.currentItem.item
  const rightSidebar = useRightSidebar(currentItem?.type)
  const currentItemId = currentItem?._id
  const previousItemIdRef = useRef(currentItemId)

  useEffect(() => {
    if (previousItemIdRef.current === currentItemId) return

    previousItemIdRef.current = currentItemId
    rightSidebar.close()
  }, [rightSidebar, currentItemId])

  return (
    <EditorWorkspaceSurface
      topbar={
        <FileTopbar
          onToggleHistory={() => rightSidebar.toggle(RIGHT_SIDEBAR_CONTENT.history)}
          source={workspaceSource}
        />
      }
      banner={<EditorBanner source={workspaceSource} />}
      rightSidebar={
        <RightSidebarContainer
          item={currentItem}
          panelServices={liveRightSidebarPanelServices}
          sidebar={rightSidebar}
        />
      }
    >
      <EditorContent source={workspaceSource} />
    </EditorWorkspaceSurface>
  )
}

function EditorBanner({ source }: { source: EditorWorkspaceSource }) {
  const { item, isLoading } = source.content.currentItem
  if (isLoading || !item || !item.isTrashed) return null
  return <TrashBanner item={item} />
}
