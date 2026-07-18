import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert, LoaderCircle, Lock, Users } from 'lucide-react'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@wizard-archive/ui/shadcn/components/select'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import type { CampaignMemberId, NoteBlockId, ResourceId } from '../../resources/domain-id'
import type { NoteBlockAccessCommand } from '../../resources/resource-command-contract'
import type {
  NoteBlockAccessGateway,
  ResourceAccessGateway,
} from '../../resources/editor-runtime-contract'
import {
  NOTE_BLOCK_VISIBILITY,
  projectNoteBlockSelectionAccess,
} from '../../resources/note-block-access-policy'
import type {
  AggregateNoteBlockVisibility,
  NoteBlockSelectionParticipant,
} from '../../resources/note-block-access-policy'

import {
  NoteBlockAccessMenuContext,
  useNoteBlockAccessKnowledge,
} from './note-block-access-menu-context'
import type { NoteBlockAccessMenuState } from './note-block-access-menu-context'

export type NoteBlockAccessMenuBinding = Readonly<{
  campaignId: Parameters<NoteBlockAccessGateway['execute']>[0]['campaignId']
  gateway: NoteBlockAccessGateway
  noteId: ResourceId
  resourceAccess: ResourceAccessGateway
}>

export function NoteBlockAccessMenuProvider({
  campaignId,
  children,
  gateway,
  noteId,
  resourceAccess,
}: {
  campaignId: NoteBlockAccessMenuBinding['campaignId']
  children: ReactNode
  gateway: NoteBlockAccessGateway
  noteId: ResourceId
  resourceAccess: ResourceAccessGateway
}) {
  const [menu, setMenu] = useState<NoteBlockAccessMenuState | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!menu) return
    menu.sideMenu.freezeMenu()
    return () => menu.sideMenu.unfreezeMenu()
  }, [menu])

  const execute = async (command: NoteBlockAccessCommand) => {
    if (pending) return false
    setPending(true)
    setError(false)
    const delivery = await gateway.execute({
      campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command,
    })
    setPending(false)
    const completed = delivery.status === 'received' && delivery.result.status === 'completed'
    setError(!completed)
    return completed
  }
  const shareNote = async (memberId: CampaignMemberId) => {
    if (pending) return false
    setPending(true)
    setError(false)
    const delivery = await resourceAccess.execute({
      campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command: {
        type: 'setMemberAccess',
        resourceIds: [noteId],
        memberId,
        permission: 'view',
      },
    })
    setPending(false)
    const completed = delivery.status === 'received' && delivery.result.status === 'completed'
    setError(!completed)
    return completed
  }

  return (
    <NoteBlockAccessMenuContext.Provider
      value={{
        error,
        gateway,
        noteId,
        pending,
        execute,
        shareNote,
        open: (nextMenu) => {
          setError(false)
          setMenu(nextMenu)
        },
      }}
    >
      {children}
      {menu &&
        typeof document !== 'undefined' &&
        createPortal(
          <FloatingBlockAccessMenu
            gateway={gateway}
            menu={menu}
            noteId={noteId}
            error={error}
            pending={pending}
            execute={execute}
            shareNote={shareNote}
            close={() => setMenu(null)}
          />,
          document.body,
        )}
    </NoteBlockAccessMenuContext.Provider>
  )
}

function FloatingBlockAccessMenu({
  close,
  execute,
  error,
  gateway,
  menu,
  noteId,
  pending,
  shareNote,
}: {
  close: () => void
  execute: (command: NoteBlockAccessCommand) => Promise<boolean>
  error: boolean
  gateway: NoteBlockAccessGateway
  menu: NoteBlockAccessMenuState
  noteId: ResourceId
  pending: boolean
  shareNote: (memberId: CampaignMemberId) => Promise<boolean>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [position, setPosition] = useState(menu.position)
  const knowledge = useNoteBlockAccessKnowledge(gateway, noteId, menu.blockIds)
  useLayoutEffect(() => {
    const rect = dialog.current?.getBoundingClientRect()
    if (!rect) return
    const next = {
      x: Math.max(8, Math.min(menu.position.x + 8, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(menu.position.y, window.innerHeight - rect.height - 8)),
    }
    setPosition(next)
  }, [menu.position])
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        !dialog.current?.contains(target) &&
        !(target instanceof Element && target.closest('[data-note-block-access-overlay]'))
      ) {
        close()
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [close])

  const selection =
    knowledge.state === 'known'
      ? projectNoteBlockSelectionAccess(knowledge.value, menu.blockIds)
      : null
  return (
    <dialog
      open
      ref={dialog}
      aria-label={menu.title}
      className="fixed z-[70] m-0 w-80 max-w-[calc(100vw-16px)] rounded-lg border-0 bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-sm font-medium">{menu.title}</p>
        {pending && (
          <LoaderCircle aria-label="Updating visibility" className="size-4 animate-spin" />
        )}
      </div>
      {knowledge.state === 'unknown' ? (
        <p className="px-1 py-3 text-xs text-muted-foreground">Loading visibility settings…</p>
      ) : knowledge.state === 'missing' || !selection ? (
        <p className="px-1 py-3 text-xs text-muted-foreground">
          Visibility is unavailable for this selection.
        </p>
      ) : (
        <div className="border-t border-border pt-1" data-testid="block-share-menu">
          {menu.kind === 'context' && (
            <Button
              className="w-full justify-start"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                void execute({
                  type: 'setNoteBlockAudienceAccess',
                  noteId,
                  blockIds: menu.blockIds,
                  shared: selection.audienceVisibility !== NOTE_BLOCK_VISIBILITY.visible,
                }).then((completed) => {
                  if (completed) close()
                })
              }}
            >
              {selection.audienceVisibility === NOTE_BLOCK_VISIBILITY.visible
                ? 'Unshare with all players'
                : 'Share with all players'}
            </Button>
          )}
          {menu.kind === 'sharing' && (
            <>
              <VisibilityRow
                icon={
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted">
                    <Users className="size-3.5 text-muted-foreground" />
                  </span>
                }
                label="All players"
                description="Default visibility for players who can view this note"
                value={selection.audienceVisibility}
                disabled={pending}
                onChange={(visibility) =>
                  execute({
                    type: 'setNoteBlockAudienceAccess',
                    noteId,
                    blockIds: menu.blockIds,
                    shared: visibility === NOTE_BLOCK_VISIBILITY.visible,
                  })
                }
              />
              {selection.participants.map((participant) => (
                <ParticipantRow
                  key={participant.participant.id}
                  blockIds={menu.blockIds}
                  disabled={pending}
                  execute={execute}
                  noteId={noteId}
                  audienceVisibility={selection.audienceVisibility}
                  shareNote={shareNote}
                  value={participant}
                />
              ))}
              {selection.participants.length === 0 && knowledge.value.participantsComplete && (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  No players in this campaign yet.
                </p>
              )}
              {!knowledge.value.participantsComplete && (
                <Button
                  className="w-full"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => gateway.loadMorePresentation(noteId, menu.blockIds)}
                >
                  Load more players
                </Button>
              )}
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="px-1 pt-2 text-xs text-destructive">
          Visibility could not be updated.
        </p>
      )}
    </dialog>
  )
}

function ParticipantRow({
  blockIds,
  audienceVisibility,
  disabled,
  execute,
  noteId,
  shareNote,
  value,
}: {
  blockIds: ReadonlyArray<NoteBlockId>
  audienceVisibility: AggregateNoteBlockVisibility
  disabled: boolean
  execute: (command: NoteBlockAccessCommand) => Promise<boolean>
  noteId: ResourceId
  shareNote: (memberId: CampaignMemberId) => Promise<boolean>
  value: NoteBlockSelectionParticipant
}) {
  const participant = value.participant
  if (value.kind === 'locked_visible') {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <UserProfileImage
          imageUrl={participant.imageUrl}
          name={participant.displayName}
          size="sm"
        />
        <Identity name={participant.displayName} username={participant.username} />
        <div className="flex h-7 min-w-24 items-center justify-between rounded-md border border-input bg-muted px-2 text-xs text-muted-foreground">
          <span>Visible</span>
          <Lock className="size-3" />
        </div>
      </div>
    )
  }
  const selectedValue = value.hasExplicitAccess ? value.visibility : 'default'
  const visibleWithoutNoteAccess =
    participant.notePermission === 'none' &&
    (value.visibility === NOTE_BLOCK_VISIBILITY.visible ||
      (!value.hasExplicitAccess && audienceVisibility === NOTE_BLOCK_VISIBILITY.visible))
  return (
    <>
      <VisibilityRow
        icon={
          <UserProfileImage
            imageUrl={participant.imageUrl}
            name={participant.displayName}
            size="sm"
          />
        }
        label={participant.displayName}
        description={`@${participant.username}`}
        value={selectedValue}
        disabled={disabled}
        allowDefault
        defaultLabel={`Default (${visibilityLabel(audienceVisibility)})`}
        onChange={(visibility) =>
          execute(
            visibility === 'default'
              ? {
                  type: 'clearNoteBlockMemberAccess',
                  noteId,
                  blockIds,
                  memberId: participant.id,
                }
              : {
                  type: 'setNoteBlockMemberAccess',
                  noteId,
                  blockIds,
                  memberId: participant.id,
                  permission: visibility === NOTE_BLOCK_VISIBILITY.visible ? 'view' : 'none',
                },
          )
        }
      />
      {visibleWithoutNoteAccess && (
        <div className="mx-1 mb-1 flex items-center gap-2 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning-foreground">
          <CircleAlert className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">This player cannot open the note.</span>
          <Button
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => void shareNote(participant.id)}
          >
            Share note
          </Button>
        </div>
      )}
    </>
  )
}

function Identity({ name, username }: { name: string; username: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm">{name}</p>
      <p className="truncate text-xs text-muted-foreground">@{username}</p>
    </div>
  )
}

function VisibilityRow({
  allowDefault = false,
  defaultLabel = 'Default',
  description,
  disabled,
  icon,
  label,
  onChange,
  value,
}: {
  allowDefault?: boolean
  defaultLabel?: string
  description: string
  disabled: boolean
  icon: ReactNode
  label: string
  onChange: (value: AggregateNoteBlockVisibility | 'default') => void
  value: AggregateNoteBlockVisibility | 'default'
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => next !== null && onChange(next)}
      >
        <SelectTrigger size="sm" className="h-7 min-w-24 text-xs">
          <SelectValue>{visibilityLabel(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" className="z-[80]" data-note-block-access-overlay>
          {value === 'mixed' && (
            <>
              <SelectItem value="mixed" disabled>
                Mixed
              </SelectItem>
              <SelectSeparator />
            </>
          )}
          {allowDefault && <SelectItem value="default">{defaultLabel}</SelectItem>}
          <SelectItem value="hidden">Hidden</SelectItem>
          <SelectItem value="visible">Visible</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

function visibilityLabel(value: AggregateNoteBlockVisibility | 'default') {
  return value[0]!.toUpperCase() + value.slice(1)
}
