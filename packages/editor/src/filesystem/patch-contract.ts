import type { UserProfileId, WorkspaceMemberId } from '../../../../shared/common/ids'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type {
  ResourceIconName,
  ResourceLocation,
  ResourceStatus,
  ResourceKind,
} from '../workspace/resource-contract'
import type {
  AssetId,
  CampaignId,
  CampaignMemberId,
  ResourceId,
  ResourceShareId,
  SessionId,
} from '../resources/domain-id'

export type ResourcePatchRow = {
  id: ResourceId
  createdAt: number
  name: string
  slug: string
  parentId: ResourceId | null
  workspaceId: CampaignId
  type: ResourceKind
  color: string | null
  iconName: ResourceIconName | null
  location: ResourceLocation
  status: ResourceStatus
  allPermissionLevel: PermissionLevel | null
  updatedTime: number | null
  updatedBy: UserProfileId | null
  createdBy: UserProfileId
  deletionTime: number | null
  deletedBy: UserProfileId | null
  previewAssetId: AssetId | null
}

type ResourcePatchFields = {
  name: string
  slug: string
  iconName: ResourceIconName | null
  color: string | null
  parentId: ResourceId | null
  status: ResourceStatus
  allPermissionLevel: PermissionLevel | null
  previewAssetId: AssetId | null
  updatedTime: number | null
  updatedBy: UserProfileId | null
  deletionTime: number | null
  deletedBy: UserProfileId | null
}
type ResourceFieldPatch = Partial<ResourcePatchFields>
type ResourcePatchPrecondition = ResourceFieldPatch &
  Partial<Pick<ResourcePatchRow, 'type' | 'createdBy'>>

type ResourcePatchSource = Pick<
  ResourcePatchRow,
  | 'name'
  | 'slug'
  | 'iconName'
  | 'color'
  | 'parentId'
  | 'status'
  | 'allPermissionLevel'
  | 'previewAssetId'
  | 'updatedTime'
  | 'updatedBy'
  | 'deletionTime'
  | 'deletedBy'
>

const SIDEBAR_ITEM_PATCH_FIELD_KEYS = [
  'name',
  'slug',
  'iconName',
  'color',
  'parentId',
  'status',
  'allPermissionLevel',
  'previewAssetId',
  'updatedTime',
  'updatedBy',
  'deletionTime',
  'deletedBy',
] as const satisfies ReadonlyArray<keyof ResourcePatchFields>

type ResourceSharePatchRow = {
  id: ResourceShareId
  createdAt: number
  workspaceId: CampaignId
  resourceId: ResourceId
  sidebarItemType: ResourceKind
  memberId: CampaignMemberId
  sessionId: SessionId | null
  permissionLevel: PermissionLevel | null
}

type ResourceSharePatchFields = {
  permissionLevel: PermissionLevel | null
}
type ResourceShareFieldPatch = ResourceSharePatchFields
type ResourceSharePatchPrecondition = ResourceSharePatchFields

type FolderSharePatchRow = {
  folderId: ResourceId
  inheritShares: boolean
}

type FolderSharePatchFields = {
  inheritShares: boolean
}
type FolderShareFieldPatch = FolderSharePatchFields
type FolderSharePatchPrecondition = FolderSharePatchFields

export type ResourcePatch =
  | {
      type: 'upsertResource'
      item: ResourcePatchRow
    }
  | {
      type: 'updateResource'
      itemId: ResourceId
      before: ResourcePatchPrecondition
      fields: ResourceFieldPatch
    }
  | {
      type: 'removeResource'
      itemId: ResourceId
      snapshot: ResourcePatchRow
    }
  | {
      type: 'upsertResourceShare'
      share: ResourceSharePatchRow
    }
  | {
      type: 'updateResourceShare'
      resourceId: ResourceId
      memberId: CampaignMemberId
      before: ResourceSharePatchPrecondition
      fields: ResourceShareFieldPatch
    }
  | {
      type: 'removeResourceShare'
      share: ResourceSharePatchRow
    }
  | {
      type: 'updateFolderShare'
      folderId: ResourceId
      before: FolderSharePatchPrecondition
      fields: FolderShareFieldPatch
    }
  | {
      type: 'setResourceBookmarkState'
      itemId: ResourceId
      isBookmarked: boolean
    }

export type ResourceChange =
  | {
      type: 'insertResource'
      itemId: ResourceId
      after: ResourcePatchRow
    }
  | {
      type: 'updateResource'
      itemId: ResourceId
      before: ResourcePatchRow
      after: ResourcePatchRow
    }
  | {
      type: 'removeResource'
      itemId: ResourceId
      before: ResourcePatchRow
    }
  | {
      type: 'insertResourceShare'
      after: ResourceSharePatchRow
    }
  | {
      type: 'updateResourceShare'
      before: ResourceSharePatchRow
      after: ResourceSharePatchRow
    }
  | {
      type: 'removeResourceShare'
      before: ResourceSharePatchRow
    }
  | {
      type: 'updateFolderShare'
      before: FolderSharePatchRow
      after: FolderSharePatchRow
    }
  | {
      type: 'updateResourceBookmarkState'
      itemId: ResourceId
      memberId: WorkspaceMemberId
      before: boolean
      after: boolean
    }

export function valuesMatch(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object'
  ) {
    return false
  }
  return deepEqual(before, after)
}

function deepEqual(before: unknown, after: unknown): boolean {
  if (Object.is(before, after)) return true
  if (
    before === null ||
    after === null ||
    typeof before !== 'object' ||
    typeof after !== 'object'
  ) {
    return false
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length) {
      return false
    }
    return before.every((value, index) => deepEqual(value, after[index]))
  }

  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>
  const beforeKeys = Object.keys(beforeRecord)
  const afterKeys = Object.keys(afterRecord)
  if (beforeKeys.length !== afterKeys.length) return false

  return beforeKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(afterRecord, key) &&
      deepEqual(beforeRecord[key], afterRecord[key]),
  )
}

export function setPatchField(
  patch: ResourceFieldPatch,
  key: keyof ResourcePatchFields,
  value: ResourcePatchFields[keyof ResourcePatchFields] | undefined,
): void {
  if (value !== undefined) {
    const writablePatch = patch as Record<keyof ResourcePatchFields, unknown>
    writablePatch[key] = value
  }
}

function resourcePatchFields(item: ResourcePatchSource): ResourcePatchFields {
  const fields: ResourceFieldPatch = {}
  for (const key of SIDEBAR_ITEM_PATCH_FIELD_KEYS) {
    setPatchField(fields, key, item[key])
  }
  return fields as ResourcePatchFields
}

export function diffResourceFields(
  before: ResourcePatchSource,
  after: ResourcePatchSource,
): { changed: ResourceFieldPatch; previous: ResourceFieldPatch } {
  const beforeFields = resourcePatchFields(before)
  const afterFields = resourcePatchFields(after)
  const changed: ResourceFieldPatch = {}
  const previous: ResourceFieldPatch = {}

  for (const key of SIDEBAR_ITEM_PATCH_FIELD_KEYS) {
    if (valuesMatch(beforeFields[key], afterFields[key])) continue
    setPatchField(changed, key, afterFields[key])
    setPatchField(previous, key, beforeFields[key])
  }

  return { changed, previous }
}

export function diffResourceShareFields(
  before: ResourceSharePatchRow,
  after: ResourceSharePatchRow,
): { changed: ResourceShareFieldPatch; previous: ResourceSharePatchPrecondition } | null {
  if (valuesMatch(before.permissionLevel, after.permissionLevel)) {
    return null
  }
  return {
    changed: { permissionLevel: after.permissionLevel } satisfies ResourceShareFieldPatch,
    previous: { permissionLevel: before.permissionLevel } satisfies ResourceShareFieldPatch,
  }
}

export function diffFolderShareFields(
  before: FolderSharePatchRow,
  after: FolderSharePatchRow,
): { changed: FolderShareFieldPatch; previous: FolderSharePatchPrecondition } | null {
  if (valuesMatch(before.inheritShares, after.inheritShares)) {
    return null
  }
  return {
    changed: { inheritShares: after.inheritShares } satisfies FolderShareFieldPatch,
    previous: { inheritShares: before.inheritShares } satisfies FolderShareFieldPatch,
  }
}

export function hasMismatchedPrecondition(
  item: Record<string, unknown>,
  before: Record<string, unknown>,
): boolean {
  return Object.entries(before).some(
    ([key, value]) =>
      !Object.prototype.hasOwnProperty.call(item, key) || !valuesMatch(item[key], value),
  )
}
