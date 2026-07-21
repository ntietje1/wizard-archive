import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import { RESOURCE_KIND } from '../resource-record'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { resourceKindIcon } from './resource-icon'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'

export function ResourceCreateMenu({
  actions,
  label,
  parentId,
  runtime,
  variant = 'icon',
}: {
  actions: WorkspaceActions
  label: string
  parentId: ResourceId | null
  runtime: EditorRuntime
  variant?: 'card' | 'icon'
}) {
  const [open, setOpen] = useState(false)
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, parentId)
  const blocked = creation.blocked
  return (
    <div className={variant === 'card' ? 'relative h-[140px]' : 'relative'}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        disabled={blocked}
        className={
          variant === 'card'
            ? 'flex h-full w-full items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            : 'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
        }
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute left-0 z-30 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md ${
            variant === 'card' ? 'top-full mt-1' : 'top-8'
          }`}
        >
          {(
            [
              RESOURCE_KIND.note,
              RESOURCE_KIND.folder,
              RESOURCE_KIND.map,
              RESOURCE_KIND.canvas,
              RESOURCE_KIND.file,
            ] as const
          ).map((kind) => {
            const Icon = resourceKindIcon(kind)
            const isPending = creation.pendingControlId === kind
            return (
              <button
                key={kind}
                role="menuitem"
                type="button"
                aria-busy={isPending}
                disabled={blocked}
                className="flex h-8 w-full items-center gap-2 rounded px-2 text-sm hover:bg-muted"
                onClick={async () => {
                  const settlement = await creation.run(kind, (signal) =>
                    actions.create(kind, parentId, '', signal),
                  )
                  if (settlement.status === 'completed') setOpen(false)
                }}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                {resourceKindLabel(kind)}
              </button>
            )
          })}
          <WorkspaceCreationStatus creation={creation} onCompleted={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
