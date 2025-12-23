import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type {EditorViewerProps} from '~/lib/editor-registry';
import {
  
  getViewerComponent
} from '~/lib/editor-registry'

export function SidebarItemEditor({
  item,
  search,
}: EditorViewerProps<AnySidebarItem>) {
  const ViewerComponent = getViewerComponent(item.type)
  if (!ViewerComponent) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No viewer available for item type: {item.type}
      </div>
    )
  }

  return <ViewerComponent item={item} search={search} />
}
