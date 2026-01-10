import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { EditableBreadcrumb } from './editable-breadcrumb'
import {
  CloseButton,
  ContextMenuButton,
  EditorViewModeToggleButton,
} from './editor-action-buttons'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { Skeleton } from '~/components/shadcn/ui/skeleton'
import { TopbarContextMenu } from '~/components/context-menu/topbar/TopbarContextMenu'

export function FileTopbar() {
  const { item, isLoading } = useCurrentItem()
  const { navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem(item)

  const ancestors = useQuery(
    convexQuery(
      api.sidebarItems.queries.getSidebarItemAncestors,
      item
        ? {
            campaignId: item.campaignId,
            id: item._id,
          }
        : 'skip',
    ),
  )

  const defaultName = defaultItemName(item)

  if (isLoading) {
    return <TopbarLoading />
  }

  if (!item) {
    return <TopbarEmpty />
  }

  return (
    <TopbarContextMenu item={item}>
      <div className="flex items-center px-4 py-2 h-12 border-b bg-white w-full min-w-0 overflow-hidden gap-4">
        <EditableBreadcrumb
          initialName={item.name || ''}
          defaultName={defaultName || 'Untitled'}
          onRename={rename}
          ancestors={ancestors.data ?? []}
          onNavigateToItem={navigateToItem}
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          <EditorViewModeToggleButton />
          <ContextMenuButton />
          <CloseButton />
        </div>
      </div>
    </TopbarContextMenu>
  )
}

function TopbarLoading() {
  return (
    <div className="border-b p-2 h-12">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  )
}

function TopbarEmpty() {
  return (
    <div className="flex items-center justify-between px-4 py-2 h-12 border-b bg-white w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between w-full h-12" />
    </div>
  )
}
