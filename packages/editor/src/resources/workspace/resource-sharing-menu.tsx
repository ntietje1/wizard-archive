import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { LoaderCircle, Users } from 'lucide-react'
import { UserProfileImage } from '@wizard-archive/ui/components/user-profile-image'
import { PopoverContent } from '@wizard-archive/ui/shadcn/components/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@wizard-archive/ui/shadcn/components/select'
import { Switch } from '@wizard-archive/ui/shadcn/components/switch'
import { DOMAIN_ID_KIND, generateDomainId } from '../domain-id'
import type { ResourceAccessCommand } from '../resource-command-contract'
import type {
  ResourceAccessParticipant,
  ResourceAccessPresentation,
  ResourcePermission,
} from '../resource-access-policy'
import type { EditorRuntime, ResourceAccessGateway } from '../editor-runtime-contract'
import type { AuthorizedResourceSummary } from '../resource-index-contract'

type PermissionValue = 'default' | ResourcePermission

const permissionLabels: Readonly<Record<ResourcePermission, string>> = {
  none: 'None',
  view: 'View',
  edit: 'Edit',
}

export function ResourceSharingMenu({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const accessCapability = runtime.resources.access
  if (accessCapability.status !== 'available') return null
  return (
    <AvailableResourceSharingMenu
      access={accessCapability.value}
      resource={resource}
      runtime={runtime}
    />
  )
}

function AvailableResourceSharingMenu({
  access,
  resource,
  runtime,
}: {
  access: ResourceAccessGateway
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const knowledge = useSyncExternalStore(
    (listener) => access.subscribe(resource.id, listener),
    () => access.getPresentation(resource.id),
  )

  useEffect(() => {
    access.loadPresentation(resource.id)
  }, [access, resource.id])

  const execute = async (command: ResourceAccessCommand) => {
    setPending(true)
    setError(false)
    const delivery = await access.execute({
      campaignId: runtime.scope.campaignId,
      operationId: generateDomainId(DOMAIN_ID_KIND.operation),
      command,
    })
    setPending(false)
    if (delivery.status !== 'received' || delivery.result.status !== 'completed') setError(true)
  }

  return (
    <PopoverContent
      role="dialog"
      aria-label={`Share ${resource.title}`}
      align="end"
      className="w-80 gap-0 p-2"
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Share</p>
          <p className="truncate text-xs text-muted-foreground">{resource.title}</p>
        </div>
        {pending && <LoaderCircle aria-label="Updating sharing" className="size-4 animate-spin" />}
      </div>
      {knowledge.state === 'unknown' ? (
        <p className="px-1 py-3 text-xs text-muted-foreground">Loading sharing settings…</p>
      ) : knowledge.state === 'missing' ? (
        <p className="px-1 py-3 text-xs text-muted-foreground">
          Sharing is unavailable for this resource.
        </p>
      ) : (
        <SharingControls
          disabled={pending}
          execute={execute}
          presentation={knowledge.value}
          resource={resource}
          runtime={runtime}
        />
      )}
      {error && (
        <p role="alert" className="px-1 pt-2 text-xs text-destructive">
          Sharing could not be updated.
        </p>
      )}
    </PopoverContent>
  )
}

function SharingControls({
  disabled,
  execute,
  presentation,
  resource,
  runtime,
}: {
  disabled: boolean
  execute: (command: ResourceAccessCommand) => Promise<void>
  presentation: ResourceAccessPresentation
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const audienceValue: PermissionValue =
    presentation.policy.audienceAccess.state === 'explicit'
      ? presentation.policy.audienceAccess.permission
      : 'default'
  return (
    <div className="border-t border-border pt-1">
      <PermissionRow
        icon={
          <span className="flex size-6 items-center justify-center rounded-full bg-muted">
            <Users className="size-3.5 text-muted-foreground" />
          </span>
        }
        label="All players"
        description={effectiveAccessLabel(presentation.defaultAccess, resource.id, runtime)}
        value={audienceValue}
        disabled={disabled}
        onChange={(value) =>
          execute(
            value === 'default'
              ? { type: 'clearAudienceAccess', resourceIds: [resource.id] }
              : {
                  type: 'setAudienceAccess',
                  resourceIds: [resource.id],
                  permission: value,
                },
          )
        }
      />
      {presentation.participants.map((participant) => (
        <ParticipantPermissionRow
          key={participant.id}
          disabled={disabled}
          execute={execute}
          participant={participant}
          resource={resource}
          runtime={runtime}
        />
      ))}
      {presentation.participants.length === 0 && (
        <p className="px-1 py-2 text-xs text-muted-foreground">No players in this campaign yet.</p>
      )}
      {presentation.policy.subject === 'folder' && (
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border px-1 pt-2">
          <div>
            <p className="text-sm">Share through descendants</p>
            <p className="text-xs text-muted-foreground">
              Descendants can inherit this folder&apos;s access.
            </p>
          </div>
          <Switch
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
      )}
    </div>
  )
}

function ParticipantPermissionRow({
  disabled,
  execute,
  participant,
  resource,
  runtime,
}: {
  disabled: boolean
  execute: (command: ResourceAccessCommand) => Promise<void>
  participant: ResourceAccessParticipant
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const value: PermissionValue =
    participant.access.state === 'explicit' ? participant.access.permission : 'default'
  return (
    <PermissionRow
      icon={
        <UserProfileImage
          imageUrl={participant.imageUrl}
          name={participant.displayName}
          size="sm"
        />
      }
      label={participant.displayName}
      description={
        participant.username
          ? `@${participant.username} · ${effectiveAccessLabel(
              participant.effectiveAccess,
              resource.id,
              runtime,
            )}`
          : effectiveAccessLabel(participant.effectiveAccess, resource.id, runtime)
      }
      value={value}
      disabled={disabled}
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
  )
}

function PermissionRow({
  description,
  disabled,
  icon,
  label,
  onChange,
  value,
}: {
  description: string
  disabled: boolean
  icon: ReactNode
  label: string
  onChange: (value: PermissionValue) => void
  value: PermissionValue
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1.5">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <PermissionSelect disabled={disabled} onChange={onChange} value={value} />
    </div>
  )
}

function PermissionSelect({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean
  onChange: (value: PermissionValue) => void
  value: PermissionValue
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => nextValue !== null && onChange(nextValue)}
    >
      <SelectTrigger size="sm" className="h-7 min-w-24 text-xs">
        <SelectValue>{value === 'default' ? 'Default' : permissionLabels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end" className="z-[60]">
        <SelectItem value="default">Default</SelectItem>
        <SelectItem value="none">None</SelectItem>
        <SelectItem value="view">View</SelectItem>
        <SelectItem value="edit">Edit</SelectItem>
      </SelectContent>
    </Select>
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
