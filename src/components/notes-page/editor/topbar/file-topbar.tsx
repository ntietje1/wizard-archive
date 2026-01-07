import { useRef } from 'react'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { TopbarContextMenuRef } from '~/components/context-menu/topbar/TopbarContextMenu'
import { EditableTopbar } from '~/components/notes-page/editor/topbar/editable-topbar'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useMenuActions } from '~/components/context-menu/actions'
import { TopbarContextMenu } from '~/components/context-menu/topbar/TopbarContextMenu'

export function FileTopbar() {
  const { item, isLoading } = useCurrentItem()
  const { clearEditorContent, navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem(item)
  const { Dialogs } = useMenuActions()

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

  const topbarContextMenuRef = useRef<TopbarContextMenuRef>(null)

  const defaultName = defaultItemName(item)

  if (isLoading || !item) {
    return (
      <>
        <EditableTopbar name="" isEmpty={true} onRename={rename} />
        <Dialogs />
      </>
    )
  }

  return (
    <TopbarContextMenu ref={topbarContextMenuRef} item={item}>
      <EditableTopbar
        name={item.name}
        defaultName={defaultName}
        onRename={rename}
        onClose={clearEditorContent}
        onNavigateToItem={navigateToItem}
        ancestors={ancestors.data ?? []}
        onOpenMenu={(e) => {
          topbarContextMenuRef.current?.open({
            x: e.clientX,
            y: e.clientY,
          })
        }}
      />
      <Dialogs />
    </TopbarContextMenu>
  )
}
