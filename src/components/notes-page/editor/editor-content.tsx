import { PageEditorEmptyContent, PageEditorWrapper  } from '../viewer/page-editor-wrapper'
import { SidebarItemEditor } from '../viewer/sidebar-item-editor'
import { shouldShowPageBar } from '~/lib/editor-registry'
import { useCurrentItem } from '~/hooks/useCurrentItem'

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
