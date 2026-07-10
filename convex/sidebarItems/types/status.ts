import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { Doc, Id } from '../../_generated/dataModel'
import type { WithoutSystemFields } from 'convex/server'
import type { ResourceStatus } from '@wizard-archive/editor/resources/resource-contract'
import { normalizeResourceNameForComparison } from '@wizard-archive/editor/resources/resource-contract'

export type SidebarItemLifecycleFields = {
  status: ResourceStatus
  deletionTime?: number | null
  deletedBy?: Id<'userProfiles'> | null
}

type ConsistentSidebarItemLifecycle =
  | {
      status: typeof RESOURCE_STATUS.active | typeof RESOURCE_STATUS.undoHidden
      deletionTime: null
      deletedBy: null
    }
  | {
      status: typeof RESOURCE_STATUS.trashed
      deletionTime: number
      deletedBy: Id<'userProfiles'>
    }

export function assertSidebarItemLifecycleConsistency<T extends SidebarItemLifecycleFields>(
  item: T,
): asserts item is T & ConsistentSidebarItemLifecycle {
  if (
    item.status === RESOURCE_STATUS.trashed &&
    (item.deletionTime == null || item.deletedBy == null)
  ) {
    throw new Error('Trashed sidebar items require deletion metadata')
  }
  if (
    item.status === RESOURCE_STATUS.active &&
    (item.deletionTime != null || item.deletedBy != null)
  ) {
    throw new Error('Active sidebar items cannot have trash lifecycle metadata')
  }
  if (
    item.status === RESOURCE_STATUS.undoHidden &&
    (item.deletionTime != null || item.deletedBy != null)
  ) {
    throw new Error('Undo-hidden sidebar items cannot have trash lifecycle metadata')
  }
}

export function toSidebarItemDocument<T extends SidebarItemLifecycleFields>(item: T) {
  assertSidebarItemLifecycleConsistency(item)
  return item as T & Doc<'sidebarItems'>
}

export function toSidebarItemReplacement<T extends SidebarItemLifecycleFields>(item: T) {
  const document = toSidebarItemDocument(item)
  const common = {
    name: document.name,
    normalizedName: normalizeResourceNameForComparison(document.name),
    slug: document.slug,
    campaignId: document.campaignId,
    iconName: document.iconName,
    color: document.color,
    type: document.type,
    parentId: document.parentId,
    allPermissionLevel: document.allPermissionLevel,
    location: document.location,
    status: document.status,
    previewStorageId: document.previewStorageId,
    previewUpdatedAt: document.previewUpdatedAt,
    updatedTime: document.updatedTime,
    updatedBy: document.updatedBy,
    createdBy: document.createdBy,
  }
  switch (document.status) {
    case RESOURCE_STATUS.active:
    case RESOURCE_STATUS.undoHidden:
      return {
        ...common,
        status: document.status,
        deletionTime: null,
        deletedBy: null,
      } satisfies WithoutSystemFields<Doc<'sidebarItems'>>
    case RESOURCE_STATUS.trashed:
      return {
        ...common,
        status: document.status,
        deletionTime: document.deletionTime,
        deletedBy: document.deletedBy,
      } satisfies WithoutSystemFields<Doc<'sidebarItems'>>
  }
}

export function isActiveSidebarItem(item: SidebarItemLifecycleFields): boolean {
  return item.status === RESOURCE_STATUS.active
}

export function isTrashedSidebarItem(item: SidebarItemLifecycleFields): boolean {
  return item.status === RESOURCE_STATUS.trashed
}

export function isUndoHiddenSidebarItem(item: SidebarItemLifecycleFields): boolean {
  return item.status === RESOURCE_STATUS.undoHidden
}
