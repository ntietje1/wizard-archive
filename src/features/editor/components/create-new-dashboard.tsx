import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { CreateNewDashboardSurface } from './create-new-dashboard-surface'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { useEditorWorkspaceSource } from '../workspace/editor-workspace-source-context'
import { handleError } from '~/shared/utils/logger'

interface CreateNewDashboardProps {
  parentId: Id<'sidebarItems'> | null
  folderPath?: string
}

export function CreateNewDashboard({ parentId, folderPath }: CreateNewDashboardProps) {
  const {
    items: { createItem, creationDraft },
    navigation: { openItemBySlug },
  } = useEditorWorkspaceSource()
  const [creatingCommandId, setCreatingCommandId] = useState<
    SidebarItemCreationCommand['id'] | null
  >(null)

  const isDisabled = creatingCommandId !== null

  const handleCreate = async (command: SidebarItemCreationCommand) => {
    if (isDisabled) return

    setCreatingCommandId(command.id)
    try {
      const name = creationDraft.pendingName.trim() || undefined
      const result = await createItem({ type: command.type, parentId, name })
      if (result) {
        await openItemBySlug(result.slug)
      }
    } catch (error) {
      handleError(error, 'Failed to create item')
    } finally {
      setCreatingCommandId(null)
    }
  }

  return (
    <CreateNewDashboardSurface
      folderPath={folderPath}
      creatingCommandId={creatingCommandId}
      disabled={isDisabled}
      onCreate={(command) => void handleCreate(command)}
    />
  )
}
