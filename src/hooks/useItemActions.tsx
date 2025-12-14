import { useState, useMemo, useCallback, type ReactNode } from 'react'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useNoteActions } from './useNoteActions'
import { useTagActions } from './useTagActions'
import { useMapActions } from './useMapActions'
import { useFolderActions } from './useFolderActions'
import { Trash2 } from '~/lib/icons'
import type { ContextMenuItem } from '~/components/context-menu/components/ContextMenu'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { TagDeleteConfirmDialog } from '~/components/dialogs/delete/tag-delete-confirm-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import type { TagCategoryConfig } from '~/components/forms/category-tag-form/base-tag-form/types'
import { getCategoryIcon } from '~/lib/category-icons'
import { CATEGORY_KIND } from 'convex/tags/types'
import { useMutation } from '@tanstack/react-query'
import { useConvexMutation, useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/contexts/CampaignContext'
import { toast } from 'sonner'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'

type Options = {
  onDeleted?: () => void
  onSlugChange?: (item: AnySidebarItem) => void
}

export type UseItemActionsResult = {
  rename: (newName: string) => Promise<void>
  menuItems: ContextMenuItem[]
  deleteDialog: ReactNode
  defaultName: string
  readOnly: boolean
  isDeleting: boolean
}

export function useItemActions(
  item: AnySidebarItem | null,
  options?: Options,
): UseItemActionsResult {
  const { updateNote } = useNoteActions()
  const { updateTag } = useTagActions()
  const { updateMap } = useMapActions()
  const { updateFolder } = useFolderActions()
  const { campaignWithMembership } = useCampaign()
  const convex = useConvex()
  const campaignId = campaignWithMembership.data?.campaign._id

  const updateCategory = useMutation({
    mutationFn: useConvexMutation(api.tags.mutations.updateTagCategory),
  })

  const [isDeleting, setIsDeleting] = useState(false)

  const onDeleted = options?.onDeleted
  const onSlugChange = options?.onSlugChange

  const rename = useCallback(
    async (newName: string) => {
      if (!item || !newName || !campaignId) return

      const oldSlug = item.slug

      try {
        switch (item.type) {
          case 'notes':
            await updateNote.mutateAsync({ noteId: item._id, name: newName })
            break
          case 'tags':
            await updateTag.mutateAsync({ tagId: item._id, name: newName })
            break
          case 'gameMaps':
            await updateMap.mutateAsync({ mapId: item._id, name: newName })
            break
          case 'folders':
            await updateFolder.mutateAsync({
              folderId: item._id,
              name: newName,
            })
            break
          case 'tagCategories': {
            await updateCategory.mutateAsync({
              categoryId: item._id,
              categoryName: newName,
            })
            break
          }
          default:
            break
        }

        if (onSlugChange) {
          const updatedItem = await convex.query(
            api.sidebarItems.queries.getSidebarItem,
            {
              id: item._id,
              campaignId,
            },
          )

          if (updatedItem && updatedItem.slug !== oldSlug) {
            onSlugChange(updatedItem)
          }
        }
      } catch (error) {
        console.error(error)
        toast.error('Failed to update name')
        throw error
      }
    },
    [
      convex,
      item,
      campaignId,
      updateNote,
      updateTag,
      updateMap,
      updateFolder,
      updateCategory,
      onSlugChange,
    ],
  )

  const handleDeleteSuccess = useCallback(() => {
    setIsDeleting(false)
    onDeleted?.()
  }, [onDeleted])

  const categoryConfig: TagCategoryConfig | undefined = useMemo(() => {
    if (item?.type !== 'tags' || !item.category) return undefined
    return {
      singular: item.category.name || '',
      plural: item.category.pluralName || '',
      icon: getCategoryIcon(item.category.iconName),
      categorySlug: item.category.slug,
    }
  }, [item])

  const menuItems: ContextMenuItem[] = useMemo(() => {
    if (!item) return []
    if (item.type === 'tagCategories') return []

    return [
      {
        type: 'action',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => setIsDeleting(true),
        className: 'text-red-600 focus:text-red-600',
      },
    ]
  }, [item])

  const deleteDialog = useMemo(() => {
    if (!item) return null
    switch (item.type) {
      case 'notes':
        return (
          <NoteDeleteConfirmDialog
            note={item}
            isDeleting={isDeleting}
            onClose={() => setIsDeleting(false)}
            onConfirm={handleDeleteSuccess}
          />
        )
      case 'tags':
        return categoryConfig ? (
          <TagDeleteConfirmDialog
            tag={item}
            categoryConfig={categoryConfig}
            isDeleting={isDeleting}
            onClose={() => setIsDeleting(false)}
            onConfirm={handleDeleteSuccess}
          />
        ) : null
      case 'gameMaps':
        return (
          <MapDeleteConfirmDialog
            map={item}
            isDeleting={isDeleting}
            onClose={() => setIsDeleting(false)}
            onConfirm={handleDeleteSuccess}
          />
        )
      case 'folders':
        return (
          <FolderDeleteConfirmDialog
            folder={item}
            isDeleting={isDeleting}
            onClose={() => setIsDeleting(false)}
            onConfirm={handleDeleteSuccess}
          />
        )
      default:
        return null
    }
  }, [item, isDeleting, handleDeleteSuccess, categoryConfig])

  const defaultName = defaultItemName(item)

  const readOnly =
    item?.type === 'tagCategories' && item.kind !== CATEGORY_KIND.User

  return {
    rename,
    menuItems,
    deleteDialog,
    defaultName,
    readOnly,
    isDeleting,
  }
}
