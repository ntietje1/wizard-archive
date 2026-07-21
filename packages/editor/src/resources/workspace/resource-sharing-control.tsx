import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp, LoaderCircle, Lock, Users } from 'lucide-react'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import usePersistedState from '@wizard-archive/ui/hooks/use-persisted-state'
import { Avatar, AvatarFallback, AvatarImage } from '@wizard-archive/ui/shadcn/components/avatar'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@wizard-archive/ui/shadcn/components/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@wizard-archive/ui/shadcn/components/select'
import { Switch } from '@wizard-archive/ui/shadcn/components/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@wizard-archive/ui/shadcn/components/tooltip'
import { getInitials } from '@wizard-archive/ui/utils/get-initials'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type {
  ResourceAccessCommand,
  ResourceAccessCommandGateway,
} from '../resource-command-contract'
import type {
  ResourceAccessParticipant,
  ResourceAccessPresentation,
  ResourcePermission,
} from '../resource-access-policy'
import type { EditorRuntime, ResourceAccessPresentationSource } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'
import { useResourceStoreSnapshot } from './resource-store-snapshot'

type PermissionValue = 'default' | ResourcePermission

const permissionLabels: Readonly<Record<ResourcePermission, string>> = {
  none: 'None',
  view: 'View',
  edit: 'Edit',
}

const permissionOptions = Object.entries(permissionLabels) as Array<[ResourcePermission, string]>

export function ResourceSharingControl({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const capability = runtime.resources.access
  if (capability.status !== 'available' || capability.value.mode !== 'editable') return null
  return (
    <AvailableResourceSharingControl
      commands={capability.value.commands}
      presentation={capability.value.presentation}
      resource={resource}
      runtime={runtime}
    />
  )
}

function AvailableResourceSharingControl({
  commands,
  presentation,
  resource,
  runtime,
}: {
  commands: ResourceAccessCommandGateway
  presentation: ResourceAccessPresentationSource
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const knowledge = useResourceStoreSnapshot(presentation, resource.id)

  const ready = knowledge.state === 'known'
  const shared = ready && hasSharedAccess(knowledge.value)
  const label = knowledge.state === 'missing' ? 'Unavailable' : shared ? 'Shared' : 'Private'
  const StatusIcon = shared ? Users : Lock
  const Chevron = open ? ChevronUp : ChevronDown
  const execute = async (command: ResourceAccessCommand) => {
    setPending(true)
    setError(false)
    const delivery = await commands.execute({
      campaignId: runtime.scope.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command,
    })
    setPending(false)
    if (delivery.status !== 'received' || delivery.result.status !== 'completed') setError(true)
  }

  return (
    <Popover open={ready && open} onOpenChange={(nextOpen) => ready && setOpen(nextOpen)}>
      <PopoverTrigger
        nativeButton
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2"
            disabled={!ready}
          >
            <StatusIcon className="size-3.5" />
            <span className="text-xs">{label}</span>
            <Chevron className="size-3 text-muted-foreground" />
          </Button>
        }
      />
      {ready && (
        <PopoverContent
          role="dialog"
          aria-label={`Share ${resource.title}`}
          align="end"
          side="bottom"
          sideOffset={4}
          className="w-[320px] max-w-full gap-0 p-2"
        >
          <SharingPanel
            disabled={pending}
            error={error}
            execute={execute}
            loadMoreParticipants={() => presentation.loadMore(resource.id)}
            pending={pending}
            presentation={knowledge.value}
            resource={resource}
            runtime={runtime}
          />
        </PopoverContent>
      )}
    </Popover>
  )
}

function SharingPanel({
  disabled,
  error,
  execute,
  loadMoreParticipants,
  pending,
  presentation,
  resource,
  runtime,
}: {
  disabled: boolean
  error: boolean
  execute: (command: ResourceAccessCommand) => Promise<void>
  loadMoreParticipants: () => void
  pending: boolean
  presentation: ResourceAccessPresentation
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [showPlayers, setShowPlayers] = usePersistedState(
    'resource-share-show-players',
    false,
    parseBoolean,
  )
  const explicitParticipants = presentation.participants.filter(
    (participant) => participant.access.state === 'explicit',
  )
  const defaultParticipants = presentation.participants.filter(
    (participant) => participant.access.state === 'default',
  )

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex min-w-0 items-center justify-between gap-2 px-1 pb-1">
        <p className="truncate text-sm font-medium">
          Share <span className="text-muted-foreground">&quot;{resource.title}&quot;</span>
        </p>
        {pending && <LoaderCircle aria-label="Updating sharing" className="size-4 animate-spin" />}
      </div>
      <div className="mb-0.5 h-px bg-border" />
      {explicitParticipants.map((participant) => (
        <ParticipantPermissionRow
          key={participant.id}
          disabled={disabled}
          execute={execute}
          participant={participant}
          resource={resource}
          runtime={runtime}
          defaultPermission={presentation.defaultAccess.permission}
        />
      ))}
      {explicitParticipants.length > 0 && <div className="my-0.5 h-px bg-border" />}
      <AudiencePermissionRow
        defaultParticipants={defaultParticipants}
        disabled={disabled}
        execute={execute}
        expanded={showPlayers}
        label={explicitParticipants.length === 0 ? 'All Players' : 'Other Players'}
        presentation={presentation}
        resource={resource}
        runtime={runtime}
        onToggle={() => setShowPlayers((value) => !value)}
      />
      {showPlayers && (
        <ExpandedParticipantList
          defaultPermission={presentation.defaultAccess.permission}
          disabled={disabled}
          execute={execute}
          participants={defaultParticipants}
          resource={resource}
          runtime={runtime}
          participantsComplete={presentation.participantsComplete}
          onLoadMore={loadMoreParticipants}
        />
      )}
      {presentation.policy.subject === 'folder' && (
        <>
          <div className="my-0.5 h-px bg-border" />
          <SharingTooltip text="Descendants can inherit this folder's access.">
            <div className="flex items-center justify-between gap-2 p-1">
              <span className="min-w-0 flex-1 truncate text-sm">Share through descendants</span>
              <Switch
                size="sm"
                aria-label="Share through descendants"
                checked={presentation.policy.inheritance === 'enabled'}
                disabled={disabled}
                onCheckedChange={(enabled) =>
                  void execute({
                    type: 'setFolderAccessInheritance',
                    folderId: resource.id,
                    inheritance: enabled ? 'enabled' : 'disabled',
                  })
                }
              />
            </div>
          </SharingTooltip>
        </>
      )}
      {error && (
        <p role="alert" className="px-1 pt-1 text-xs text-destructive">
          Sharing could not be updated.
        </p>
      )}
    </div>
  )
}

function AudiencePermissionRow({
  defaultParticipants,
  disabled,
  execute,
  expanded,
  label,
  onToggle,
  presentation,
  resource,
  runtime,
}: {
  defaultParticipants: ReadonlyArray<ResourceAccessParticipant>
  disabled: boolean
  execute: (command: ResourceAccessCommand) => Promise<void>
  expanded: boolean
  label: string
  onToggle: () => void
  presentation: ResourceAccessPresentation
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const value: PermissionValue =
    presentation.policy.audienceAccess.state === 'explicit'
      ? presentation.policy.audienceAccess.permission
      : 'default'
  const Chevron = expanded ? ChevronUp : ChevronDown
  return (
    <SharingTooltip
      text={`This is the default permission for all players. ${effectiveAccessLabel(
        presentation.defaultAccess,
        resource.id,
        runtime,
      )}.`}
    >
      <div className="flex items-center gap-2.5 px-1 py-1.5 select-none">
        <button
          type="button"
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-80"
          onClick={onToggle}
        >
          <AudienceIcon participants={defaultParticipants} expanded={expanded} />
          <span className="flex min-w-0 flex-1 items-center gap-1 text-left">
            <span className="truncate text-sm font-medium">{label}</span>
            <Chevron className="size-3.5 shrink-0 text-muted-foreground" />
          </span>
        </button>
        <PermissionSelect
          ariaLabel="All Players permission"
          defaultLabel={
            presentation.policy.audienceAccess.state === 'default'
              ? `Default (${permissionLabels[presentation.defaultAccess.permission]})`
              : 'Default'
          }
          disabled={disabled}
          label={permissionLabels[presentation.defaultAccess.permission]}
          value={value}
          onChange={(permission) =>
            execute(
              permission === 'default'
                ? { type: 'clearAudienceAccess', resourceIds: [resource.id] }
                : {
                    type: 'setAudienceAccess',
                    resourceIds: [resource.id],
                    permission,
                  },
            )
          }
        />
      </div>
    </SharingTooltip>
  )
}

function ExpandedParticipantList({
  defaultPermission,
  disabled,
  execute,
  participants,
  participantsComplete,
  onLoadMore,
  resource,
  runtime,
}: {
  defaultPermission: ResourcePermission
  disabled: boolean
  execute: (command: ResourceAccessCommand) => Promise<void>
  participants: ReadonlyArray<ResourceAccessParticipant>
  participantsComplete: boolean
  onLoadMore: () => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  if (participants.length === 0 && participantsComplete) {
    return (
      <div className="ml-4">
        <TreeItem isLast>
          <p className="px-1 py-1 text-xs text-muted-foreground">
            No players use the default permission.
          </p>
        </TreeItem>
      </div>
    )
  }
  return (
    <div className="ml-4">
      {participants.map((participant, index) => (
        <TreeItem
          key={participant.id}
          isLast={participantsComplete && index === participants.length - 1}
        >
          <ParticipantPermissionRow
            defaultPermission={defaultPermission}
            disabled={disabled}
            execute={execute}
            participant={participant}
            resource={resource}
            runtime={runtime}
          />
        </TreeItem>
      ))}
      {!participantsComplete && (
        <TreeItem isLast>
          <Button type="button" variant="ghost" size="sm" onClick={onLoadMore}>
            Load more players
          </Button>
        </TreeItem>
      )}
    </div>
  )
}

function ParticipantPermissionRow({
  defaultPermission,
  disabled,
  execute,
  participant,
  resource,
  runtime,
}: {
  defaultPermission: ResourcePermission
  disabled: boolean
  execute: (command: ResourceAccessCommand) => Promise<void>
  participant: ResourceAccessParticipant
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const value: PermissionValue =
    participant.access.state === 'explicit' ? participant.access.permission : 'default'
  return (
    <SharingTooltip
      text={`${participant.displayName}'s access: ${effectiveAccessLabel(
        participant.effectiveAccess,
        resource.id,
        runtime,
      )}.`}
    >
      <div className="flex items-center gap-2.5 px-1 py-1.5 select-none">
        <UserProfileImage
          imageUrl={participant.imageUrl}
          name={participant.displayName}
          size="sm"
        />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-sm font-medium">{participant.displayName}</span>
          {participant.username && (
            <span className="truncate text-xs text-muted-foreground">@{participant.username}</span>
          )}
        </div>
        <PermissionSelect
          ariaLabel={`${participant.displayName} permission`}
          defaultLabel={`Default (${permissionLabels[defaultPermission]})`}
          disabled={disabled}
          label={permissionLabels[participant.effectiveAccess.permission]}
          value={value}
          onChange={(permission) =>
            execute(
              permission === 'default'
                ? {
                    type: 'clearMemberAccess',
                    resourceIds: [resource.id],
                    memberId: participant.id,
                  }
                : {
                    type: 'setMemberAccess',
                    resourceIds: [resource.id],
                    memberId: participant.id,
                    permission,
                  },
            )
          }
        />
      </div>
    </SharingTooltip>
  )
}

function PermissionSelect({
  ariaLabel,
  defaultLabel,
  disabled,
  label,
  onChange,
  value,
}: {
  ariaLabel: string
  defaultLabel: string
  disabled: boolean
  label: string
  onChange: (value: PermissionValue) => void
  value: PermissionValue
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => nextValue !== null && onChange(nextValue)}
    >
      <SelectTrigger aria-label={ariaLabel} size="sm" className="h-7 min-w-[110px] text-xs">
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent
        align="end"
        alignItemWithTrigger={false}
        className="z-[10000] p-1"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SelectItem value="default">{defaultLabel}</SelectItem>
        {permissionOptions.map(([permission, optionLabel]) => (
          <SelectItem key={permission} value={permission}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AudienceIcon({
  expanded,
  participants,
}: {
  expanded: boolean
  participants: ReadonlyArray<ResourceAccessParticipant>
}) {
  if (expanded || participants.length === 0) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Users className="size-3.5 text-muted-foreground" />
      </span>
    )
  }
  return (
    <div className="flex shrink-0 items-center">
      {participants.slice(0, 3).map((participant, index) => (
        <Avatar
          key={participant.id}
          size="sm"
          className={`${index > 0 ? '-ml-2 ' : ''}ring-2 ring-background`}
        >
          {participant.imageUrl && (
            <AvatarImage src={participant.imageUrl} alt={participant.displayName} />
          )}
          <AvatarFallback>
            {getInitials(participant.displayName, participant.username)}
          </AvatarFallback>
        </Avatar>
      ))}
      {participants.length > 3 && (
        <Avatar size="sm" className="-ml-2 ring-2 ring-background">
          <AvatarFallback>+{participants.length - 3}</AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

function TreeItem({ children, isLast }: { children: ReactNode; isLast: boolean }) {
  return (
    <div className="relative flex items-center">
      <div className={`absolute left-0 top-0 w-px bg-border ${isLast ? 'h-1/2' : 'h-full'}`} />
      <div className="w-2 shrink-0 border-t border-border" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function SharingTooltip({ children, text }: { children: ReactNode; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>{children}</TooltipTrigger>
      <TooltipContent side="left" className="z-[10000] max-w-[220px]">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

function hasSharedAccess(presentation: ResourceAccessPresentation) {
  return (
    presentation.defaultAccess.permission !== 'none' ||
    presentation.participants.some(
      (participant) => participant.effectiveAccess.permission !== 'none',
    )
  )
}

function effectiveAccessLabel(
  access: ResourceAccessPresentation['defaultAccess'],
  resourceId: AuthorizedResourceSummary['id'],
  runtime: EditorRuntime,
) {
  const permission = permissionLabels[access.permission]
  if (access.source.type === 'none') return permission
  if (access.source.resourceId === resourceId) {
    return `${permission} · explicit ${access.source.type}`
  }
  const source = runtime.resources.index.getSnapshot().lookup(access.source.resourceId)
  return source.state === 'known' ? `${permission} from ${source.value.title}` : permission
}

function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}
