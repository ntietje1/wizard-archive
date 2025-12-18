import { useMemo } from 'react'
import { EditableTopbar } from '~/components/notes-page/editor/topbar/editable-topbar'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useMenuActions } from '~/components/context-menu/actions'
import type { ContextMenuItem } from '~/components/context-menu/components/ContextMenu'
import { isTagCategory } from '~/lib/sidebar-item-utils'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'
import { useContextEnhancers } from '~/components/context-menu/hooks/useContextEnhancers'
import { useMenuContext } from '~/components/context-menu/hooks/useMenuContext'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useMenuItemsFromContext } from '~/components/context-menu/hooks/useMenuItemsFromContext'

export function FileTopbar() {
  const { item, isLoading } = useCurrentItem()
  const { clearEditorContent, navigateToItem } = useEditorNavigation()
  const { rename } = useRenameItem(item)
  const { Dialogs } = useMenuActions()

  const categoryQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagCategory,
      item && !isTagCategory(item) && item.categoryId
        ? {
            campaignId: item.campaignId,
            categoryId: item.categoryId,
          }
        : 'skip',
    ),
  )

  const category = isTagCategory(item) ? item : categoryQuery.data

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

  // Use enhancers to build context
  const enhancers = useContextEnhancers({ category })
  const menuContext = useMenuContext({
    item: item || undefined,
    viewContext: 'topbar',
    enhancers,
  })

  // Build menu items from context
  const unifiedMenuItems = useMenuItemsFromContext(menuContext)

  const computedMenuItems: ContextMenuItem[] = useMemo(() => {
    if (isTagCategory(item)) {
      return [
        ...unifiedMenuItems,
      ]
    }
    return unifiedMenuItems
  }, [item, unifiedMenuItems])

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
    <SidebarItemContextMenu
      item={item}
      viewContext="topbar"
      category={category}
    >
      <EditableTopbar
        name={item.name}
        defaultName={defaultName}
        onRename={rename}
        onClose={clearEditorContent}
        onNavigateToItem={navigateToItem}
        ancestors={ancestors.data ?? []}
        menuItems={computedMenuItems}
      />
      <Dialogs />
    </SidebarItemContextMenu>
  )
}
