import { useCurrentItem } from '~/hooks/useCurrentItem'
import { PageEditorEmptyContent, PageEditorSkeleton } from './page-editor'
import { getViewerComponent } from '~/lib/editor-registry'

export function EditorContent() {
  const { item, config, isLoading, search } = useCurrentItem()

  if (isLoading) return <PageEditorSkeleton />

  if (!item || !config) {
    return <PageEditorEmptyContent />
  }

  const ViewerComponent = item.type ? getViewerComponent(item.type) : null

  if (!ViewerComponent) return <PageEditorEmptyContent />

  return <ViewerComponent item={item} search={search} />
}
