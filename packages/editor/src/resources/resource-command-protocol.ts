import { sha256Digest } from './component-version'
import type { Sha256Digest } from './component-version'
import { DOMAIN_ID_KIND, assertDomainId } from './domain-id'
import type { CampaignMemberId, NoteBlockId, OperationId, ResourceId } from './domain-id'
import type {
  DeepCopyResourcesCommand,
  MoveResourcesCommand,
  NoteBlockAccessCommand,
  ResourceAccessCommand,
  ResourceBookmarkCommand,
  ResourcePermission,
  ResourceStructureCommand,
  ResourceStructureRejection,
  RestoreResourcesCommand,
  TrashResourcesCommand,
  UpdateResourceMetadataCommand,
} from './resource-command-contract'
import { RESOURCE_KIND, canonicalizeResourceTitle } from './resource-record'
import type { ResourceKind } from './resource-record'

export const RESOURCE_COMMAND_PROTOCOL_VERSION = 'resource-command-v1' as const

const textEncoder = new TextEncoder()
const resourceKinds = new Set<ResourceKind>(Object.values(RESOURCE_KIND))
const resourcePermissions = new Set<ResourcePermission>(['none', 'view', 'edit'])

export function resourceStructureInputRejection(error: unknown): ResourceStructureRejection {
  if (!(error instanceof Error)) return 'invalid_command'
  if (error.message.includes('UUIDv7')) return 'invalid_uuid'
  if (error.message.includes('title') || error.message.includes('Title')) return 'invalid_title'
  return 'invalid_command'
}

function normalizeResourceId(value: ResourceId): ResourceId {
  return assertDomainId(DOMAIN_ID_KIND.resource, value)
}

function normalizeResourceIdSet(values: ReadonlyArray<ResourceId>): ReadonlyArray<ResourceId> {
  const normalized = Array.from(new Set(values.map(normalizeResourceId))).sort()
  if (normalized.length === 0) throw new TypeError('A resource selection cannot be empty')
  return normalized
}

function normalizeParentId(value: ResourceId | null): ResourceId | null {
  return value === null ? null : normalizeResourceId(value)
}

function normalizeMemberId(value: CampaignMemberId): CampaignMemberId {
  return assertDomainId(DOMAIN_ID_KIND.campaignMember, value)
}

function normalizeNoteBlockIdSet(values: ReadonlyArray<NoteBlockId>): ReadonlyArray<NoteBlockId> {
  const normalized = Array.from(
    new Set(values.map((value) => assertDomainId(DOMAIN_ID_KIND.noteBlock, value))),
  ).sort()
  if (normalized.length === 0) throw new TypeError('A note block selection cannot be empty')
  return normalized
}

function normalizePermission(value: ResourcePermission): ResourcePermission {
  if (!resourcePermissions.has(value)) throw new TypeError('Invalid resource permission')
  return value
}

function normalizeResourceKind(value: ResourceKind): ResourceKind {
  if (!resourceKinds.has(value)) throw new TypeError('Invalid resource kind')
  return value
}

function normalizeNullableString(value: string | null, field: string): string | null {
  if (value !== null && typeof value !== 'string') throw new TypeError(`Invalid ${field}`)
  return value
}

function normalizeBoolean(value: boolean, field: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`Invalid ${field}`)
  return value
}

function normalizeMetadataUpdate(
  command: UpdateResourceMetadataCommand,
): UpdateResourceMetadataCommand {
  const changes: UpdateResourceMetadataCommand['changes'] = {
    ...(command.changes.title === undefined
      ? {}
      : { title: canonicalizeResourceTitle(command.changes.title) }),
    ...(command.changes.icon === undefined
      ? {}
      : { icon: normalizeNullableString(command.changes.icon, 'resource icon') }),
    ...(command.changes.color === undefined
      ? {}
      : { color: normalizeNullableString(command.changes.color, 'resource color') }),
  }
  if (Object.keys(changes).length === 0) throw new TypeError('A metadata update cannot be empty')
  return {
    type: 'updateMetadata',
    resourceId: normalizeResourceId(command.resourceId),
    changes,
  }
}

function normalizeMove(command: MoveResourcesCommand): MoveResourcesCommand {
  return {
    type: 'move',
    resourceIds: normalizeResourceIdSet(command.resourceIds),
    destinationParentId: normalizeParentId(command.destinationParentId),
  }
}

function normalizeTrash(command: TrashResourcesCommand): TrashResourcesCommand {
  return { type: 'trash', resourceIds: normalizeResourceIdSet(command.resourceIds) }
}

function normalizeRestore(command: RestoreResourcesCommand): RestoreResourcesCommand {
  return { type: 'restore', resourceIds: normalizeResourceIdSet(command.resourceIds) }
}

function normalizeDeepCopy(command: DeepCopyResourcesCommand): DeepCopyResourcesCommand {
  return {
    type: 'deepCopy',
    sourceRootIds: normalizeResourceIdSet(command.sourceRootIds),
    destinationParentId: normalizeParentId(command.destinationParentId),
  }
}

export function normalizeResourceStructureCommand(
  command: ResourceStructureCommand,
): ResourceStructureCommand {
  switch (command.type) {
    case 'create':
      return {
        type: 'create',
        resourceId: normalizeResourceId(command.resourceId),
        kind: normalizeResourceKind(command.kind),
        parentId: normalizeParentId(command.parentId),
        title: canonicalizeResourceTitle(command.title),
        icon: normalizeNullableString(command.icon, 'resource icon'),
        color: normalizeNullableString(command.color, 'resource color'),
      }
    case 'updateMetadata':
      return normalizeMetadataUpdate(command)
    case 'move':
      return normalizeMove(command)
    case 'trash':
      return normalizeTrash(command)
    case 'restore':
      return normalizeRestore(command)
    case 'permanentlyDelete':
      return {
        type: 'permanentlyDelete',
        resourceIds: normalizeResourceIdSet(command.resourceIds),
      }
    case 'deepCopy':
      return normalizeDeepCopy(command)
  }
}

export function normalizeResourceAccessCommand(
  command: ResourceAccessCommand,
): ResourceAccessCommand {
  switch (command.type) {
    case 'setAudienceAccess':
      return {
        type: 'setAudienceAccess',
        resourceIds: normalizeResourceIdSet(command.resourceIds),
        permission: normalizePermission(command.permission),
      }
    case 'setMemberAccess':
      return {
        type: 'setMemberAccess',
        resourceIds: normalizeResourceIdSet(command.resourceIds),
        memberId: normalizeMemberId(command.memberId),
        permission: normalizePermission(command.permission),
      }
    case 'clearMemberAccess':
      return {
        type: 'clearMemberAccess',
        resourceIds: normalizeResourceIdSet(command.resourceIds),
        memberId: normalizeMemberId(command.memberId),
      }
    case 'setFolderAccessInheritance':
      return {
        type: 'setFolderAccessInheritance',
        folderId: normalizeResourceId(command.folderId),
        inherited: normalizeBoolean(command.inherited, 'folder inheritance state'),
      }
  }
}

export function normalizeResourceBookmarkCommand(
  command: ResourceBookmarkCommand,
): ResourceBookmarkCommand {
  return {
    type: 'setBookmarkState',
    resourceIds: normalizeResourceIdSet(command.resourceIds),
    bookmarked: normalizeBoolean(command.bookmarked, 'bookmark state'),
  }
}

export function normalizeNoteBlockAccessCommand(
  command: NoteBlockAccessCommand,
): NoteBlockAccessCommand {
  switch (command.type) {
    case 'setNoteBlockAudienceAccess':
      return {
        type: 'setNoteBlockAudienceAccess',
        noteId: normalizeResourceId(command.noteId),
        blockIds: normalizeNoteBlockIdSet(command.blockIds),
        shared: normalizeBoolean(command.shared, 'note block audience state'),
      }
    case 'setNoteBlockMemberAccess': {
      const permission = normalizePermission(command.permission)
      if (permission === 'edit') throw new TypeError('Note block access cannot grant edit')
      return {
        type: 'setNoteBlockMemberAccess',
        noteId: normalizeResourceId(command.noteId),
        blockIds: normalizeNoteBlockIdSet(command.blockIds),
        memberId: normalizeMemberId(command.memberId),
        permission,
      }
    }
    case 'clearNoteBlockMemberAccess':
      return {
        type: 'clearNoteBlockMemberAccess',
        noteId: normalizeResourceId(command.noteId),
        blockIds: normalizeNoteBlockIdSet(command.blockIds),
        memberId: normalizeMemberId(command.memberId),
      }
  }
}

function encodeCommand(family: string, command: object): Uint8Array {
  return textEncoder.encode(
    JSON.stringify({ protocolVersion: RESOURCE_COMMAND_PROTOCOL_VERSION, family, command }),
  )
}

export function encodeResourceStructureCommand(command: ResourceStructureCommand): Uint8Array {
  return encodeCommand('structure', normalizeResourceStructureCommand(command))
}

export async function fingerprintResourceStructureCommand(
  command: ResourceStructureCommand,
): Promise<Sha256Digest> {
  return await sha256Digest(encodeResourceStructureCommand(command))
}

export async function fingerprintResourceCompensationRequest(
  originalOperationId: OperationId,
): Promise<Sha256Digest> {
  return await sha256Digest(encodeCommand('structure-compensation', { originalOperationId }))
}

export async function fingerprintResourceAccessCommand(
  command: ResourceAccessCommand,
): Promise<Sha256Digest> {
  return await sha256Digest(encodeCommand('access', normalizeResourceAccessCommand(command)))
}

export async function fingerprintResourceBookmarkCommand(
  command: ResourceBookmarkCommand,
): Promise<Sha256Digest> {
  return await sha256Digest(encodeCommand('bookmark', normalizeResourceBookmarkCommand(command)))
}

export async function fingerprintNoteBlockAccessCommand(
  command: NoteBlockAccessCommand,
): Promise<Sha256Digest> {
  return await sha256Digest(
    encodeCommand('noteBlockAccess', normalizeNoteBlockAccessCommand(command)),
  )
}
