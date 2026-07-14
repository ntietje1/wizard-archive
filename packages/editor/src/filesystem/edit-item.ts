import { canonicalizeResourceItemTitle } from '../workspace/items'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import {
  coerceSidebarItemColorForInput,
  coerceSidebarItemIconNameForInput,
} from '../workspace/items/appearance'
import type { AnyItem } from '../workspace/items'
import type { ResourceColor, ResourceIconName } from '../workspace/resource-contract'
import type { ResourceTitle } from '../resources/resource-contract'

import type { FileSystemItemMetadataUpdateOperations } from './item-operation-contracts'
import type { FileSystemPermissions } from './permissions'

interface EditItemBase {
  name?: string
  iconName?: string | null
  color?: string | null
}

export type EditFileSystemItemFn = (args: EditItemBase & { item: AnyItem }) => Promise<void>

type EditFileSystemItemSource = {
  operations: FileSystemItemMetadataUpdateOperations
  permissions: Pick<FileSystemPermissions, 'canMutateItem'>
}

type NormalizedSidebarMetadataUpdate = {
  name?: ResourceTitle
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
): NormalizedSidebarMetadataUpdate {
  return {
    name: args.name === undefined ? undefined : canonicalizeResourceItemTitle(args.name),
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
  operations,
  permissions,
}: EditFileSystemItemSource): EditFileSystemItemFn {
  return async (args: EditItemBase & { item: AnyItem }): Promise<void> => {
    const { item } = args
    const canEditItem = permissions.canMutateItem(item, PERMISSION_LEVEL.EDIT)
    const requestedTitle =
      args.name === undefined ? undefined : canonicalizeResourceItemTitle(args.name)
    const requestsMetadataChange =
      (requestedTitle !== undefined && requestedTitle !== item.name) ||
      (args.iconName !== undefined && args.iconName !== item.iconName) ||
      (args.color !== undefined && args.color !== item.color)
    if (requestsMetadataChange && !canEditItem) {
      throw new Error('Sidebar item editing is not supported')
    }
    const metadataUpdate = normalizeSidebarMetadataUpdate(args)
    const hasMetadataChange = hasSidebarMetadataChange(item, metadataUpdate)
    if (hasMetadataChange && !canEditItem) {
      throw new Error('Sidebar item editing is not supported')
    }
    if (hasMetadataChange && canEditItem) {
      await operations.updateItemMetadata({
        item,
        name: metadataUpdate.name,
        iconName: metadataUpdate.iconName,
        color: metadataUpdate.color,
      })
    }
  }
}
