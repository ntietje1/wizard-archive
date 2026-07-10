import { createWorkspaceResource } from '../workspace/runtime'
import { CREATE_PARENT_TARGET_KIND } from '../workspace/items'
import type { CreateItemSource } from './create-item-source'
import type { WorkspaceNavigation } from '../workspace/runtime'
import type { FileSystemItemCreateOperations } from './item-operation-contracts'
import type { FileSystemPermissions } from './permissions'

export type RuntimeCreateItemSourceInput = {
  navigation: Pick<WorkspaceNavigation, 'openCreateDashboard' | 'openItem'>
  filesystem: {
    operations: FileSystemItemCreateOperations
    permissions: Pick<FileSystemPermissions, 'canCreateItems'>
  }
}

export function createRuntimeCreateItemSource(
  runtime: RuntimeCreateItemSourceInput,
): CreateItemSource {
  const {
    filesystem: { operations, permissions },
    navigation,
  } = runtime

  return {
    canCreateItems: () => permissions.canCreateItems,
    createItem: ({ name, parentId, type }) =>
      operations.createItem({
        name,
        type,
        parentTarget: { kind: CREATE_PARENT_TARGET_KIND.direct, parentId },
      }),
    openCreateDashboard: navigation.openCreateDashboard,
    openItem: (itemId) => navigation.openItem(createWorkspaceResource(itemId)),
  }
}
