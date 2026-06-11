import type { SidebarItemPatchRow } from './types'
import type {
  FolderShareFieldPatch,
  FolderSharePatchRow,
  SidebarItemFieldPatch,
  SidebarItemPatchFields,
  SidebarItemShareFieldPatch,
  SidebarItemSharePatchRow,
} from './receipts'

const SIDEBAR_ITEM_PATCH_FIELD_KEYS = [
  'name',
  'slug',
  'iconName',
  'color',
  'parentId',
  'status',
  'allPermissionLevel',
  'previewStorageId',
  'previewLockedUntil',
  'previewClaimToken',
  'previewUpdatedAt',
  'updatedTime',
  'updatedBy',
  'deletionTime',
  'deletedBy',
] as const satisfies ReadonlyArray<keyof SidebarItemPatchFields>

type SidebarItemPatchSource = Pick<
  SidebarItemPatchRow,
  (typeof SIDEBAR_ITEM_PATCH_FIELD_KEYS)[number]
>

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
  patch: SidebarItemFieldPatch,
  key: keyof SidebarItemPatchFields,
  value: SidebarItemPatchFields[keyof SidebarItemPatchFields] | undefined,
) {
  if (value !== undefined) {
    ;(patch as Record<keyof SidebarItemPatchFields, unknown>)[key] = value
  }
}

function sidebarItemPatchFields(item: SidebarItemPatchSource): SidebarItemPatchFields {
  const fields: SidebarItemFieldPatch = {}
  for (const key of SIDEBAR_ITEM_PATCH_FIELD_KEYS) {
    setPatchField(fields, key, item[key])
  }
  return fields as SidebarItemPatchFields
}

export function diffSidebarItemFields(
  before: SidebarItemPatchSource,
  after: SidebarItemPatchSource,
): { changed: SidebarItemFieldPatch; previous: SidebarItemFieldPatch } {
  const beforeFields = sidebarItemPatchFields(before)
  const afterFields = sidebarItemPatchFields(after)
  const changed: SidebarItemFieldPatch = {}
  const previous: SidebarItemFieldPatch = {}

  for (const key of SIDEBAR_ITEM_PATCH_FIELD_KEYS) {
    if (valuesMatch(beforeFields[key], afterFields[key])) continue
    setPatchField(changed, key, afterFields[key])
    setPatchField(previous, key, beforeFields[key])
  }

  return { changed, previous }
}

export function diffSidebarItemShareFields(
  before: SidebarItemSharePatchRow,
  after: SidebarItemSharePatchRow,
): { changed: SidebarItemShareFieldPatch; previous: SidebarItemShareFieldPatch } {
  if (valuesMatch(before.permissionLevel, after.permissionLevel)) {
    return { changed: {}, previous: {} }
  }
  return {
    changed: { permissionLevel: after.permissionLevel },
    previous: { permissionLevel: before.permissionLevel },
  }
}

export function diffFolderShareFields(
  before: FolderSharePatchRow,
  after: FolderSharePatchRow,
): { changed: FolderShareFieldPatch; previous: FolderShareFieldPatch } {
  if (valuesMatch(before.inheritShares, after.inheritShares)) {
    return { changed: {}, previous: {} }
  }
  return {
    changed: { inheritShares: after.inheritShares },
    previous: { inheritShares: before.inheritShares },
  }
}

export function hasMismatchedPrecondition(
  item: Record<string, unknown>,
  before: Record<string, unknown>,
) {
  return Object.entries(before).some(
    ([key, value]) =>
      !Object.prototype.hasOwnProperty.call(item, key) || !valuesMatch(item[key], value),
  )
}
