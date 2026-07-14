import type { ResourceId } from '../../resources/domain-id'
import type { FileSystemPermissions } from '../../filesystem/permissions'
import type { ResourceCatalog } from '../../filesystem/catalog'
import type { FileSystemItemMetadataOperations } from '../../filesystem/item-operation-contracts'
import type { ResourceShareSource, ViewAsParticipantCapability } from '../../sharing/contracts'
import type { ResourceHistory } from '../../filesystem/history-types'
import type { AnyItem } from '../items'
import type { CurrentItemState, WorkspaceNavigation, WorkspaceNavigationState } from '../runtime'

export interface FileTopbarSource {
  current: Pick<CurrentItemState, 'availabilityState' | 'item'>
  getTrashItemCount: () => number
  getVisibleAncestors: (itemId: ResourceId) => ReadonlyArray<AnyItem>
  history: Pick<ResourceHistory, 'status'>
  operations: FileSystemItemMetadataOperations
  permissions: Pick<FileSystemPermissions, 'canAccessItem' | 'canEdit' | 'canMutateItem'>
  sharing: {
    items: ResourceShareSource
    viewAsParticipant: ViewAsParticipantCapability
  }
  navigation: {
    current: WorkspaceNavigationState
    openItem: WorkspaceNavigation['openItem']
  }
}

export type RuntimeFileTopbarSourceInput = {
  navigation: Pick<WorkspaceNavigation, 'current' | 'openItem'>
  filesystem: {
    catalog: Pick<ResourceCatalog, 'getTrashedItems' | 'getVisibleAncestors'>
    current: Pick<CurrentItemState, 'availabilityState' | 'item'>
    history: Pick<ResourceHistory, 'status'>
    operations: FileSystemItemMetadataOperations
    permissions: Pick<FileSystemPermissions, 'canAccessItem' | 'canEdit' | 'canMutateItem'>
    sharing: {
      items: ResourceShareSource
      viewAsParticipant: ViewAsParticipantCapability
    }
  }
}

export function createRuntimeFileTopbarSource(
  runtime: RuntimeFileTopbarSourceInput,
): FileTopbarSource {
  const { navigation } = runtime
  const { catalog, current, history, operations, permissions } = runtime.filesystem
  return {
    current,
    getTrashItemCount: () => catalog.getTrashedItems().length,
    getVisibleAncestors: catalog.getVisibleAncestors,
    history,
    navigation: {
      current: navigation.current,
      openItem: navigation.openItem,
    },
    operations,
    permissions,
    sharing: runtime.filesystem.sharing,
  }
}
