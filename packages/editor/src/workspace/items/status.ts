import { RESOURCE_STATUS } from '../items-persistence-contract'
import type { ResourceStatus } from '../resource-contract'

export function isTrashedSidebarItem(item: { status: ResourceStatus }): boolean {
  return item.status === RESOURCE_STATUS.trashed
}
