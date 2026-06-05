import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import type { Id } from 'convex/_generated/dataModel'
import type { LucideIcon } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { useSidebarValidation } from '~/features/sidebar/hooks/useSidebarValidation'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import { useRunSidebarItemCreationCommand } from '~/features/sidebar/hooks/useRunSidebarItemCreationCommand'

interface CreateNewButtonProps {
  icon: LucideIcon
  name: string
  description: string
  onClick: () => void
  isCreating: boolean
  disabled: boolean
}

function CreateNewButton({
  icon: Icon,
  name,
  description,
  onClick,
  isCreating,
  disabled,
}: CreateNewButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 w-full px-4 py-3 h-auto justify-start text-left group"
    >
      <div className="shrink-0 size-10 rounded-lg flex items-center justify-center bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 size-8 rounded-md flex items-center justify-center text-muted-foreground group-hover:text-foreground">
        {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      </div>
    </Button>
  )
}

interface CreateNewDashboardProps {
  parentId: Id<'sidebarItems'> | null
  folderPath?: string
}

export function CreateNewDashboard({ parentId, folderPath }: CreateNewDashboardProps) {
  const { campaignId } = useCampaign()
  const { getDefaultName } = useSidebarValidation()
  const { runCreationCommand } = useRunSidebarItemCreationCommand()
  const pendingItemName = useSidebarUIStore((s) => s.pendingItemName)
  const [creatingCommandId, setCreatingCommandId] = useState<
    SidebarItemCreationCommand['id'] | null
  >(null)

  const isDisabled = creatingCommandId !== null

  const handleCreate = async (command: SidebarItemCreationCommand) => {
    if (!campaignId || isDisabled) return

    setCreatingCommandId(command.id)
    const name = pendingItemName.trim() || getDefaultName(command.type, parentId)
    await runCreationCommand(command, { parentId, name })
    setCreatingCommandId(null)
  }

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Create New Section */}
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Create New
            </h2>
            {folderPath && <p className="text-xs text-muted-foreground mt-1">{folderPath}</p>}
          </div>
          <div className="space-y-2">
            {SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => (
              <CreateNewButton
                key={command.id}
                icon={command.icon}
                name={command.label}
                description={command.dashboardDescription}
                onClick={() => handleCreate(command)}
                disabled={isDisabled}
                isCreating={creatingCommandId === command.id}
              />
            ))}
          </div>
        </div>

        {/* Create from Template Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Create from Template
          </h2>
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Templates will appear here once created
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
