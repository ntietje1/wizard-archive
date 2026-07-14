import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { CampaignMemberId } from '../../resources/domain-id'
import type { AnyItem } from '../../workspace/items'
import type { TrashSource } from './source'
import { createRuntimeItemCardSource } from '../cards/runtime-source'
import type { RuntimeItemCardSourceInput } from '../cards/runtime-source'
import type { WorkspaceNavigation } from '../../workspace/runtime'
import type { ResourceCatalog } from '../catalog'
import { getSidebarFilesystemCapabilities } from '../capabilities'
import type { FileSystemItemTrashOperations } from '../item-operation-contracts'
import type { ViewAsParticipantCapability } from '../../sharing/contracts'
import type { FileSystemLoadState } from '../load-state'
import type { FileSystemPermissions } from '../permissions'

export type RuntimeTrashSourceInput = {
  navigation: RuntimeItemCardSourceInput['navigation'] & Pick<WorkspaceNavigation, 'openTrash'>
  filesystem: RuntimeItemCardSourceInput['filesystem'] & {
    catalog: RuntimeItemCardSourceInput['filesystem']['catalog'] &
      Pick<ResourceCatalog, 'getTrashedItems' | 'getTrashedRoots'>
    load: Pick<FileSystemLoadState, 'refreshTrash' | 'trashError' | 'trashStatus'>
    operations: FileSystemItemTrashOperations
    permissions: RuntimeItemCardSourceInput['filesystem']['permissions'] &
      Pick<
        FileSystemPermissions,
        'canCreateItems' | 'canEdit' | 'canEmptyTrash' | 'canManageFolders'
      >
    sharing: { viewAsParticipant: ViewAsParticipantCapability }
  }
}

export function createRuntimeTrashSource(runtime: RuntimeTrashSourceInput): TrashSource {
  const {
    filesystem: { catalog, load, operations, permissions },
  } = runtime
  const itemCardSource = createRuntimeItemCardSource(runtime)
  const getTrashItemCount = () => catalog.getTrashedItems().length
  const actor = {
    canCreateRootItems: permissions.canCreateItems,
    canManageFolders: permissions.canManageFolders,
  }

  return {
    ...itemCardSource,
    canDeleteItemForever: (item: AnyItem) =>
      permissions.canMutateItem(item, PERMISSION_LEVEL.FULL_ACCESS),
    canEmptyTrash: () => permissions.canEmptyTrash && getTrashItemCount() > 0,
    canRestoreItem: (item: AnyItem) => getSidebarFilesystemCapabilities(actor, [item]).canRestore,
    getDeletedByName: (deletedById: CampaignMemberId | null) => {
      if (!deletedById) return undefined

      const viewAsParticipant = runtime.filesystem.sharing.viewAsParticipant
      const participant =
        viewAsParticipant.status === 'available'
          ? viewAsParticipant.participants.find((candidate) => candidate.id === deletedById)
          : undefined
      if (participant) {
        return participant.displayName
      }

      return 'Someone'
    },
    getError: () => load.trashError,
    getItemCount: getTrashItemCount,
    getRootItems: catalog.getTrashedRoots,
    getStatus: () => load.trashStatus,
    isTrashActive: () => runtime.navigation.current.kind === 'trash',
    openTrash: runtime.navigation.openTrash,
    refresh: load.refreshTrash,
    requestDeleteItemsForever: operations.requestDeleteItemsForever,
    requestEmptyTrash: operations.requestEmptyTrash,
    restoreItems: operations.restoreItems,
  }
}
