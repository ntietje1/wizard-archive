import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { CreateNewDashboardSurface } from './create-new-dashboard-surface'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { handleError } from '~/shared/utils/logger'

interface CreateNewDashboardProps {
  parentId: Id<'sidebarItems'> | null
  folderPath?: string
}

export function CreateNewDashboard({ parentId, folderPath }: CreateNewDashboardProps) {
  const {
    commands: { createSidebarItem, openItem },
  } = useSidebarWorkspaceSource()
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const [creatingCommandId, setCreatingCommandId] = useState<
    SidebarItemCreationCommand['id'] | null
  >(null)

  const isDisabled = creatingCommandId !== null

  const handleCreate = async (command: SidebarItemCreationCommand) => {
    if (isDisabled) return

    setCreatingCommandId(command.id)
    try {
      const name = pendingItemName.trim() || undefined
      const result = await createSidebarItem({ type: command.type, parentId, name })
      if (result) {
        await openItem(result.slug)
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
