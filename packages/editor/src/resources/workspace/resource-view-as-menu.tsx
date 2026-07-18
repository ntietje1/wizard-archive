import { useState } from 'react'
import { Eye, LoaderCircle } from 'lucide-react'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import type { EditorRuntime, EditorViewAsParticipant } from '../editor-runtime-contract'

export function ResourceViewAsMenu({ viewAs }: { viewAs: EditorRuntime['viewAs'] }) {
  const [open, setOpen] = useState(false)
  if (viewAs.status !== 'available') return null
  const controller = viewAs.value
  const label = controller.pending ? 'Loading players' : 'View as player'
  const Icon = controller.pending ? LoaderCircle : Eye

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        nativeButton
        type="button"
        aria-busy={controller.pending}
        aria-label={label}
        disabled={controller.pending}
        title={label}
        className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 hover:bg-muted disabled:opacity-40 ${
          controller.selectedParticipantId ? 'text-primary' : 'text-muted-foreground'
        }`}
      >
        <Icon className={`size-4 ${controller.pending ? 'animate-spin' : ''}`} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] w-max min-w-56 max-w-[min(24rem,calc(100vw-1rem))] overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="pb-0 pt-0.5">View as player</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {controller.selectedParticipantId && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  controller.select(null)
                  setOpen(false)
                }}
              >
                Stop viewing as player
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {controller.participants.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">No other players in this workspace.</p>
          ) : (
            controller.participants.map((participant) => (
              <DropdownMenuCheckboxItem
                key={participant.id}
                checked={controller.selectedParticipantId === participant.id}
                closeOnClick={false}
                onCheckedChange={(checked) => controller.select(checked ? participant.id : null)}
                className="py-1.5 pl-2 pr-8 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
              >
                <ParticipantRow participant={participant} />
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ParticipantRow({ participant }: { participant: EditorViewAsParticipant }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <UserProfileImage
        imageUrl={participant.imageUrl}
        name={participant.displayName}
        size="sm"
        className="shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate font-medium" title={participant.displayName}>
          {participant.displayName}
        </span>
        <span className="truncate text-xs text-muted-foreground" title={`@${participant.username}`}>
          @{participant.username}
        </span>
      </span>
    </span>
  )
}
