import { EditorContent } from '../components/editor-content'
import { EditorWorkspaceSurface } from '../components/editor-workspace-surface'
import { FileTopbar } from '../components/topbar/file-topbar'
import { TrashBanner } from '../components/deleted-item-banner'
import { RightSidebarContainer } from '../components/right-sidebar/right-sidebar-container'
import { useSelectedItemSync } from '~/features/sidebar/hooks/useSelectedItem'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'

export function EditorPage() {
  useSelectedItemSync()

  return (
    <EditorWorkspaceSurface
      topbar={<FileTopbar />}
      banner={<EditorBanner />}
      rightSidebar={<RightSidebarContainer />}
    >
      <EditorContent />
    </EditorWorkspaceSurface>
  )
}

function EditorBanner() {
  const { item, isLoading } = useCurrentItem()
  if (isLoading || !item || !item.isTrashed) return null
  return <TrashBanner item={item} />
}
