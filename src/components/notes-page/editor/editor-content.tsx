import { useCurrentItem } from '~/hooks/useCurrentItem'
import { PageEditorEmptyContent } from '../viewer/page-editor-wrapper'
import { shouldShowPageBar } from '~/lib/editor-registry'
import { PageEditorWrapper } from '../viewer/page-editor-wrapper'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'

export function EditorContent() {
  const { item, config, search } = useCurrentItem()

  if (!item || !config) {
    return <PageEditorEmptyContent />
  }

  const showPageBar = shouldShowPageBar(item.type)

  if (showPageBar) {
    return <PageEditorWrapper item={item} search={search} />
  }

  return <SidebarItemEditor item={item} search={search} />
}
