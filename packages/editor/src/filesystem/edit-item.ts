import { assertResourceItemName, validateResourceItemNameWithSiblings } from '../workspace/items'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import {
  coerceSidebarItemColorForInput,
  coerceSidebarItemIconNameForInput,
} from '../workspace/items/appearance'
import type { AnyItem } from '../workspace/items'
import type {
  ResourceColor,
  ResourceName,
  ResourceSlug,
  ResourceIconName,
} from '../workspace/resource-contract'

import type { ResourceCatalog } from './catalog'
import type { FileSystemItemMetadataUpdateOperations } from './item-operation-contracts'
import type { FileSystemPermissions } from './permissions'

interface EditItemBase {
  name?: string
  iconName?: string | null
  color?: string | null
}

type EditItemResult = { slug: ResourceSlug }

export type EditFileSystemItemFn = (
  args: EditItemBase & { item: AnyItem },
) => Promise<EditItemResult>

type EditFileSystemItemSource = {
  catalog: Pick<ResourceCatalog, 'getVisibleChildren'>
  operations: FileSystemItemMetadataUpdateOperations
  permissions: Pick<FileSystemPermissions, 'canMutateItem'>
}

type NormalizedSidebarMetadataUpdate = {
  name?: ResourceName
  iconName?: ResourceIconName | null
  color?: ResourceColor | null
}

function hasSidebarMetadataChange(item: AnyItem, update: NormalizedSidebarMetadataUpdate) {
  return (
    (update.name !== undefined && update.name !== item.name) ||
    (update.iconName !== undefined && update.iconName !== item.iconName) ||
    (update.color !== undefined && update.color !== item.color)
  )
}

function normalizeSidebarMetadataUpdate(
  args: EditItemBase & { item: AnyItem },
  siblings: ReadonlyArray<AnyItem>,
): NormalizedSidebarMetadataUpdate {
  const trimmedName = args.name === undefined ? undefined : args.name.trim()
  if (trimmedName !== undefined) {
    const result = validateResourceItemNameWithSiblings(trimmedName, siblings, args.item.id)
    if (!result.valid) throw new Error(result.error)
  }

  return {
    name: trimmedName === undefined ? undefined : assertResourceItemName(trimmedName),
    iconName:
      args.iconName === undefined || args.iconName === null
        ? args.iconName
        : coerceSidebarItemIconNameForInput(args.iconName),
    color:
      args.color === undefined || args.color === null
        ? args.color
        : coerceSidebarItemColorForInput(args.color),
  }
}

export function createEditFileSystemItem({
  catalog,
  operations,
  permissions,
}: EditFileSystemItemSource): EditFileSystemItemFn {
  return async (args: EditItemBase & { item: AnyItem }): Promise<EditItemResult> => {
    const { item } = args
    const canEditItem = permissions.canMutateItem(item, PERMISSION_LEVEL.EDIT)
    const requestsMetadataChange =
      (args.name !== undefined && args.name.trim() !== item.name) ||
      (args.iconName !== undefined && args.iconName !== item.iconName) ||
      (args.color !== undefined && args.color !== item.color)
    if (requestsMetadataChange && !canEditItem) {
      throw new Error('Sidebar item editing is not supported')
    }
    const metadataUpdate = normalizeSidebarMetadataUpdate(
      args,
      catalog.getVisibleChildren(item.parentId),
    )
    const hasMetadataChange = hasSidebarMetadataChange(item, metadataUpdate)
    if (hasMetadataChange && !canEditItem) {
      throw new Error('Sidebar item editing is not supported')
    }
    let rename: EditItemResult | null = null
    if (hasMetadataChange && canEditItem) {
      rename = await operations.updateItemMetadata({
        item,
        name: metadataUpdate.name,
        iconName: metadataUpdate.iconName,
        color: metadataUpdate.color,
      })
    }

    return { slug: rename?.slug ?? item.slug }
  }
}
