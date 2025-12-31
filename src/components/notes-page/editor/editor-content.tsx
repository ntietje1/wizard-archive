import { PageEditorWrapper } from '../viewer/page-editor-wrapper'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { shouldShowPageBar } from '~/lib/editor-registry'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { LoadingSpinner } from '~/components/loading/loading-spinner'

export function EditorContent() {
  const { item, search, isLoading } = useCurrentItem()

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center">
        <p>No item selected</p>
      </div>
    )
  }

  const showPageBar = shouldShowPageBar(item.type)

  if (showPageBar) {
    return <PageEditorWrapper item={item} search={search} />
  }

  return <SidebarItemEditor item={item} search={search} />
}
