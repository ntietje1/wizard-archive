import { useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import { CreateNewDashboardSurface } from './create-new-dashboard-surface'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { useRunSidebarItemCreationCommand } from '~/features/sidebar/hooks/useRunSidebarItemCreationCommand'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'

interface CreateNewDashboardProps {
  parentId: Id<'sidebarItems'> | null
  folderPath?: string
}

export function CreateNewDashboard({ parentId, folderPath }: CreateNewDashboardProps) {
  const { campaignId } = useCampaign()
  const { getDefaultName } = useSidebarValidation()
  const { runCreationCommand } = useRunSidebarItemCreationCommand()
  const { navigateToItem } = useEditorNavigation()
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const [creatingCommandId, setCreatingCommandId] = useState<
    SidebarItemCreationCommand['id'] | null
  >(null)

  const isDisabled = creatingCommandId !== null

  const handleCreate = async (command: SidebarItemCreationCommand) => {
    if (!campaignId || isDisabled) return

    setCreatingCommandId(command.id)
    const name = pendingItemName.trim() || getDefaultName(command.type, parentId)
    const result = await runCreationCommand(command, { parentId, name })
    if (result) {
      await navigateToItem(result.slug)
    }
    setCreatingCommandId(null)
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
