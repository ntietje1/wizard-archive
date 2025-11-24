import { useSearch } from '@tanstack/react-router'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { EditableTopbar } from '~/components/notes-page/editor/topbar/editable-topbar'
import { useCurrentNote } from '~/hooks/useCurrentNote'
import { useNoteActions } from '~/hooks/useNoteActions'
import { useFolderActions } from '~/hooks/useFolderActions'
import { useMapActions } from '~/hooks/useMapActions'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { EditorSearch } from '../../validate-search'
import { UNTITLED_NOTE_TITLE } from 'convex/notes/types'
import { UNTITLED_FOLDER_NAME } from 'convex/folders/types'
import { UNTITLED_MAP_NAME } from 'convex/gameMaps/types'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useCampaign } from '~/contexts/CampaignContext'
import { Trash2 } from '~/lib/icons'
import { NoteDeleteConfirmDialog } from '~/components/dialogs/delete/note-delete-confirm-dialog'
import { FolderDeleteConfirmDialog } from '~/components/dialogs/delete/folder-delete-confirm-dialog'
import { MapDeleteConfirmDialog } from '~/components/dialogs/delete/map-delete-confirm-dialog'
import type { ContextMenuItem } from '~/components/context-menu/base/context-menu'

export function FileTopbar() {
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch

  const { navigateToNote, navigateToCategory, navigateToMap } =
    useEditorNavigation()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  // Determine content type and get data
  if (search.note) {
    return <NoteTopbar onClose={() => navigateToNote(null)} />
  }

  if (search.map && campaignId) {
    return (
      <MapTopbar
        mapSlug={search.map}
        campaignId={campaignId as import('convex/_generated/dataModel').Id<'campaigns'>}
        onClose={() => navigateToMap('')}
      />
    )
  }

  if (search.category) {
    return (
      <CategoryTopbar
        categorySlug={search.category}
        folderId={search.folderId}
        onClose={() => navigateToCategory('')}
      />
    )
  }

  // No content selected
  return <EditableTopbar name="" isEmpty={true} onRename={async () => {}} />
}

function NoteTopbar({ onClose }: { onClose: () => void }) {
  const { note, noteSlug } = useCurrentNote()
  const { updateNote } = useNoteActions()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRename = useCallback(
    async (newName: string) => {
      if (!note.data) {
        return
      }

      try {
        await updateNote.mutateAsync({ noteId: note.data._id, name: newName })
      } catch (error) {
        console.error(error)
        toast.error('Failed to update note')
        throw error
      }
    },
    [note.data, updateNote],
  )

  const handleDeleteSuccess = useCallback(() => {
    onClose()
  }, [onClose])

  const menuItems: ContextMenuItem[] = note.data
    ? [
        {
          type: 'action',
          label: 'Delete note',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => setIsDeleting(true),
          className: 'text-red-600 focus:text-red-600',
        },
      ]
    : []

  const deleteDialog = note.data ? (
    <NoteDeleteConfirmDialog
      note={note.data}
      isDeleting={isDeleting}
      onClose={() => setIsDeleting(false)}
      onConfirm={handleDeleteSuccess}
    />
  ) : null

  if (noteSlug && note.status === 'pending') {
    return <EditableTopbar name="" isLoading={true} onRename={handleRename} />
  }

  if (!note.data) {
    return <EditableTopbar name="" isEmpty={true} onRename={handleRename} />
  }

  return (
    <EditableTopbar
      name={note.data.name ?? ''}
      defaultName={UNTITLED_NOTE_TITLE}
      onRename={handleRename}
      onClose={onClose}
      menuItems={menuItems}
      deleteDialog={deleteDialog}
    />
  )
}

function MapTopbar({
  mapSlug,
  campaignId,
  onClose,
}: {
  mapSlug: string
  campaignId: import('convex/_generated/dataModel').Id<'campaigns'>
  onClose: () => void
}) {
  const mapQuery = useQuery(
    convexQuery(api.gameMaps.queries.getMapBySlug, {
      campaignId,
      slug: mapSlug,
    }),
  )

  const { updateMap } = useMapActions()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleRename = useCallback(
    async (newName: string) => {
      if (!mapQuery.data) {
        return
      }

      try {
        await updateMap.mutateAsync({ mapId: mapQuery.data._id, name: newName })
      } catch (error) {
        console.error(error)
        toast.error('Failed to update map')
        throw error
      }
    },
    [mapQuery.data, updateMap],
  )

  const menuItems: ContextMenuItem[] = mapQuery.data
    ? [
        {
          type: 'action',
          label: 'Delete map',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => setIsDeleting(true),
          className: 'text-red-600 focus:text-red-600',
        },
      ]
    : []

  const deleteDialog = mapQuery.data ? (
    <MapDeleteConfirmDialog
      map={mapQuery.data}
      isDeleting={isDeleting}
      onClose={() => setIsDeleting(false)}
    />
  ) : null

  if (mapQuery.isLoading) {
    return <EditableTopbar name="" isLoading={true} onRename={handleRename} />
  }

  if (!mapQuery.data) {
    return <EditableTopbar name="" isEmpty={true} onRename={handleRename} />
  }

  return (
    <EditableTopbar
      name={mapQuery.data.name || ''}
      defaultName={UNTITLED_MAP_NAME}
      onRename={handleRename}
      onClose={onClose}
      menuItems={menuItems}
      deleteDialog={deleteDialog}
    />
  )
}

function CategoryTopbar({
  categorySlug,
  folderId,
  onClose,
}: {
  categorySlug: string
  folderId?: string
  onClose: () => void
}) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const categoryQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoryBySlug,
      campaignId
        ? {
            campaignId,
            slug: categorySlug,
          }
        : 'skip',
    ),
  )

  const folderQuery = useQuery(
    convexQuery(
      api.folders.queries.getFolder,
      folderId && campaignId
        ? {
            folderId: folderId as import('convex/_generated/dataModel').Id<'folders'>,
          }
        : 'skip',
    ),
  )

  const { updateFolder } = useFolderActions()
  const [isDeleting, setIsDeleting] = useState(false)

  // Handle folder rename
  const handleFolderRename = useCallback(
    async (newName: string) => {
      if (!folderQuery.data) return
      try {
        await updateFolder.mutateAsync({
          folderId: folderQuery.data._id,
          name: newName,
        })
      } catch (error) {
        console.error(error)
        toast.error('Failed to update folder')
        throw error
      }
    },
    [folderQuery.data, updateFolder],
  )

  // Handle category rename
  const handleCategoryRename = useCallback(
    async (_newName: string) => {
      // TODO: implement category rename
      toast.error('Category rename not yet implemented')
      throw new Error('Not implemented')
    },
    [],
  )

  // Menu items for folder
  const folderMenuItems: ContextMenuItem[] = folderQuery.data
    ? [
        {
          type: 'action',
          label: 'Delete folder',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => setIsDeleting(true),
          className: 'text-red-600 focus:text-red-600',
        },
      ]
    : []

  const folderDeleteDialog = folderQuery.data ? (
    <FolderDeleteConfirmDialog
      folder={folderQuery.data}
      isDeleting={isDeleting}
      onClose={() => setIsDeleting(false)}
    />
  ) : null

  // Menu items for category
  const categoryMenuItems: ContextMenuItem[] = []

  // If viewing a folder, show folder topbar
  if (folderId && folderQuery.data) {
    if (folderQuery.isLoading) {
      return <EditableTopbar name="" isLoading={true} onRename={handleFolderRename} />
    }

    return (
      <EditableTopbar
        name={folderQuery.data.name || ''}
        defaultName={UNTITLED_FOLDER_NAME}
        onRename={handleFolderRename}
        onClose={onClose}
        menuItems={folderMenuItems}
        deleteDialog={folderDeleteDialog}
      />
    )
  }

  // Otherwise show category topbar
  if (categoryQuery.isLoading) {
    return <EditableTopbar name="" isLoading={true} onRename={handleCategoryRename} />
  }

  if (!categoryQuery.data) {
    return <EditableTopbar name="" isEmpty={true} onRename={handleCategoryRename} />
  }

  return (
    <EditableTopbar
      name={categoryQuery.data.pluralDisplayName || categoryQuery.data.displayName || ''}
      defaultName="Category"
      onRename={handleCategoryRename}
      onClose={onClose}
      menuItems={categoryMenuItems}
    />
  )
}

