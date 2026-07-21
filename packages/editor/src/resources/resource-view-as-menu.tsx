import { useState } from 'react'
import { Eye, LoaderCircle, UserRound } from 'lucide-react'
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

type ResourceViewAsParticipant<TParticipantId extends string> = Readonly<{
  id: TParticipantId
  displayName: string
  username: string
  imageUrl: string | null
}>

type ResourceViewAsMenuProps<TParticipantId extends string> = Readonly<{
  mode: 'editor' | 'viewer'
  onModeChange: (mode: 'editor' | 'viewer') => void
  onParticipantChange?: (participantId: TParticipantId | null) => void
  participants?: ReadonlyArray<ResourceViewAsParticipant<TParticipantId>>
  pending?: boolean
  presentation?: 'menu-item' | 'topbar'
  projection: 'dm' | 'local' | 'player' | 'view_as_player'
  selectedParticipantId?: TParticipantId | null
}>

export function ResourceViewAsMenu<TParticipantId extends string>({
  mode,
  onModeChange,
  onParticipantChange,
  participants = [],
  pending = false,
  presentation = 'topbar',
  projection,
  selectedParticipantId = null,
}: ResourceViewAsMenuProps<TParticipantId>) {
  const viewingPlayer = projection === 'view_as_player' || selectedParticipantId !== null
  const viewingSelf = mode === 'viewer' && !viewingPlayer

  if (viewingPlayer) {
    return (
      <ViewAsExitButton presentation={presentation} onExit={() => onParticipantChange?.(null)} />
    )
  }
  if (viewingSelf) {
    return <ViewAsExitButton presentation={presentation} onExit={() => onModeChange('editor')} />
  }
  return (
    <ViewAsPicker
      participants={participants}
      pending={pending}
      presentation={presentation}
      selectedParticipantId={selectedParticipantId}
      onModeChange={onModeChange}
      onParticipantChange={onParticipantChange}
    />
  )
}

function ViewAsExitButton({
  onExit,
  presentation,
}: {
  onExit: () => void
  presentation: 'menu-item' | 'topbar'
}) {
  return (
    <button
      type="button"
      role={presentation === 'menu-item' ? 'menuitem' : undefined}
      aria-label="Exit view as"
      title="Exit view as"
      className={viewAsTriggerClassName(presentation, true)}
      onClick={onExit}
    >
      <Eye className="size-4 shrink-0" />
      {presentation === 'menu-item' && <span>Exit view as</span>}
    </button>
  )
}

function ViewAsPicker<TParticipantId extends string>({
  onModeChange,
  onParticipantChange,
  participants,
  pending,
  presentation,
  selectedParticipantId,
}: {
  onModeChange: (mode: 'editor' | 'viewer') => void
  onParticipantChange?: (participantId: TParticipantId | null) => void
  participants: ReadonlyArray<ResourceViewAsParticipant<TParticipantId>>
  pending: boolean
  presentation: 'menu-item' | 'topbar'
  selectedParticipantId: TParticipantId | null
}) {
  const [open, setOpen] = useState(false)
  const label = pending ? 'Loading players' : 'View as...'
  const Icon = pending ? LoaderCircle : Eye
  const trigger = (
    <button
      type="button"
      role={presentation === 'menu-item' ? 'menuitem' : undefined}
      aria-busy={pending}
      aria-label={label}
      disabled={pending}
      title={label}
      className={viewAsTriggerClassName(presentation, false)}
    >
      <Icon className={`size-4 shrink-0 ${pending ? 'animate-spin' : ''}`} />
      {presentation === 'menu-item' && <span>View as...</span>}
    </button>
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger nativeButton render={trigger} />
      <DropdownMenuContent
        align={presentation === 'menu-item' ? 'start' : 'end'}
        side={presentation === 'menu-item' ? 'right' : 'bottom'}
        className="z-[80] w-max min-w-56 max-w-[min(24rem,calc(100vw-1rem))] overflow-hidden"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="pb-0 pt-0.5">View as...</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              onParticipantChange?.(null)
              onModeChange('viewer')
              setOpen(false)
            }}
          >
            <UserRound className="size-4" />
            View as yourself
          </DropdownMenuItem>
          {participants.length > 0 && <DropdownMenuSeparator />}
          {participants.map((participant) => (
            <DropdownMenuCheckboxItem
              key={participant.id}
              checked={selectedParticipantId === participant.id}
              onCheckedChange={(checked) => {
                if (!checked) return
                onModeChange('editor')
                onParticipantChange?.(participant.id)
                setOpen(false)
              }}
              className="py-1.5 pl-2 pr-8 [&>span:first-child]:!left-auto [&>span:first-child]:!right-2"
            >
              <ParticipantRow participant={participant} />
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function viewAsTriggerClassName(presentation: 'menu-item' | 'topbar', active: boolean): string {
  if (presentation === 'menu-item') {
    return `flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm hover:bg-muted ${
      active ? 'text-primary' : ''
    }`
  }
  return `inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 hover:bg-muted disabled:opacity-40 ${
    active ? 'bg-muted text-primary' : 'text-muted-foreground'
  }`
}

function ParticipantRow<TParticipantId extends string>({
  participant,
}: {
  participant: ResourceViewAsParticipant<TParticipantId>
}) {
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
