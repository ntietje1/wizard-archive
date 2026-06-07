import { Loader2, Plus } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'

interface CreateNewDashboardSurfaceProps {
  disabled?: boolean
  folderPath?: string
  onCreate: (command: SidebarItemCreationCommand) => void
  creatingCommandId?: SidebarItemCreationCommand['id'] | null
}

export function CreateNewDashboardSurface({
  creatingCommandId = null,
  disabled = false,
  folderPath,
  onCreate,
}: CreateNewDashboardSurfaceProps) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Create New
            </h2>
            {folderPath && <p className="mt-1 text-xs text-muted-foreground">{folderPath}</p>}
          </div>
          <div className="space-y-2">
            {SIDEBAR_ITEM_CREATION_COMMANDS.map((command) => (
              <CreateNewButton
                key={command.id}
                icon={command.icon}
                name={command.label}
                description={command.dashboardDescription}
                onClick={() => onCreate(command)}
                disabled={disabled}
                isCreating={creatingCommandId === command.id}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Create from Template
          </h2>
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No templates yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Templates will appear here once created
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateNewButton({
  description,
  disabled,
  icon: Icon,
  isCreating,
  name,
  onClick,
}: {
  description: string
  disabled: boolean
  icon: SidebarItemCreationCommand['icon']
  isCreating: boolean
  name: string
  onClick: () => void
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className="group flex h-auto w-full items-center justify-start gap-4 px-4 py-3 text-left"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground group-hover:text-foreground">
        {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      </div>
    </Button>
  )
}
