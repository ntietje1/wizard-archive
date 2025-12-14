import { useCallback, useMemo } from 'react'
import { EditableTopbar } from '~/components/notes-page/editor/topbar/editable-topbar'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import {
  useItemActions,
  type UseItemActionsResult,
} from '~/hooks/useItemActions'
import usePersistedState from '~/hooks/usePersistedState'
import {
  FOLDER_VIEW_MODE_STORAGE_KEY,
  VIEW_MODE,
  type ViewMode,
} from '~/hooks/useFolderView'
import { Folder } from '~/lib/icons'
import type { ContextMenuItem } from '~/components/context-menu/components/ContextMenu'
import { isTagCategory } from '~/lib/sidebar-item-utils'

export function FileTopbar() {
  const { item, config, isLoading, search } = useCurrentItem()
  const { navigateToItem, clearEditorContent } = useEditorNavigation()

  const [viewMode, setViewMode] = usePersistedState<ViewMode>(
    `${FOLDER_VIEW_MODE_STORAGE_KEY}-${item?._id ?? 'none'}`,
    VIEW_MODE.folderized as ViewMode,
  )

  const { rename, menuItems, deleteDialog, defaultName, readOnly } =
    useItemActions(item, {
      onDeleted: clearEditorContent,
      onSlugChange: navigateToItem,
    }) as UseItemActionsResult

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev: ViewMode) =>
      prev === VIEW_MODE.flat ? VIEW_MODE.folderized : VIEW_MODE.flat,
    )
  }, [setViewMode])

  const computedMenuItems: ContextMenuItem[] = useMemo(() => {
    if (isTagCategory(item) && !search.folderId) {
      return [
        {
          type: 'action',
          label:
            viewMode === VIEW_MODE.folderized ? 'Hide Folders' : 'Show Folders',
          icon: <Folder className="h-4 w-4" />,
          onClick: handleToggleViewMode,
        },
        ...menuItems,
      ]
    }
    return menuItems
  }, [handleToggleViewMode, item, menuItems, search.folderId, viewMode])

  if (isLoading || !item || !config) {
    return <EditableTopbar name="" isEmpty={true} onRename={rename} />
  }

  return (
    <EditableTopbar
      name={item.name ?? ''}
      defaultName={defaultName}
      onRename={rename}
      onClose={clearEditorContent}
      menuItems={computedMenuItems}
      deleteDialog={deleteDialog}
      readOnly={readOnly}
    />
  )
}
