import { useConvexMutation } from '@convex-dev/react-query'
import { useMutation } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { UNTITLED_FOLDER_NAME } from 'convex/notes/types'
import { useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { ContentCard } from '~/components/content-grid-page/content-card'
import { ConfirmationDialog } from '~/components/dialogs/confirmation-dialog'
import { FolderDialog } from '~/components/forms/folder-dialog/folder-dialog'
import { Edit, Folder, Trash2 } from '~/lib/icons'

interface FolderCardProps {
  id: Id<'folders'>
  name: string
  onClick: (e: MouseEvent) => void
  className?: string
}

export function FolderCard({
  id,
  name,
  onClick,
  className = '',
}: FolderCardProps) {
  const [editing, setEditing] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const updateFolder = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.updateFolder),
  })
  const deleteFolder = useMutation({
    mutationFn: useConvexMutation(api.notes.mutations.deleteFolder),
  })

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteFolder.mutateAsync({ folderId: id })
      setDeletingFolder(false)
    } catch (error) {
      toast.error('Failed to delete folder')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <ContentCard
        title={name || UNTITLED_FOLDER_NAME}
        icon={Folder}
        onClick={onClick}
        className={className}
        actionButtons={[
          {
            icon: Edit,
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              setEditing(true)
            },
            'aria-label': 'Edit',
          },
          {
            icon: Trash2,
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              setDeletingFolder(true)
            },
            'aria-label': 'Delete',
            variant: 'destructive-subtle',
          },
        ]}
      />

      {editing && (
        <FolderDialog
          isOpen={editing}
          onClose={() => setEditing(false)}
          mode="edit"
          folderId={id}
          initialName={name}
          onSubmit={async (values) => {
            try {
              await updateFolder.mutateAsync({
                folderId: id,
                name: values.name,
              })
              setEditing(false)
            } catch (_) {
              toast.error('Failed to update folder')
            }
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={deletingFolder}
        onClose={() => setDeletingFolder(false)}
        onConfirm={handleDelete}
        title="Delete Folder"
        description={`Are you sure you want to delete ${name ? `"${name}"` : 'this folder'}? This will also delete all notes inside this folder. This action cannot be undone.`}
        confirmLabel="Delete Folder"
        isLoading={isDeleting}
        icon={Folder}
      />
    </>
  )
}
