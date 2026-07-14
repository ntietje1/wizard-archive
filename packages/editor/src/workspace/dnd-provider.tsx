import type { ResourceId } from '../resources/domain-id'
import type { ReactNode } from 'react'

import type { WorkspaceNavigation } from './runtime'
import type { FileSystemPaths } from '../filesystem/catalog-paths'
import type { ResourceCatalog, ResourceOperationItems } from '../filesystem/catalog'
import type { FileSystemLoadState } from '../filesystem/load-state'
import { DndRuntimeProvider } from '../drag-drop/runtime-provider'
import type { DropTargetCatalog } from '../drag-drop/drop-target-data'
import { useFileDropHandler } from '../filesystem/imports/use-file-drop-handler'
import type { FileSystemItemDragDropOperations } from '../filesystem/item-operation-contracts'
import { useSidebarWorkspaceState } from './sidebar/workspace-state'
import { revealSidebarItemParents } from './sidebar/reveal'
import { createDisabledExternalFileDropCapability } from '../drag-drop/file-drop'
import type { DndExternalFileDropCapability } from '../drag-drop/file-drop'
import type { FileSystemPermissions } from '../filesystem/permissions'

type RuntimeDndInput = {
  filesystem: {
    catalog: DropTargetCatalog & Pick<ResourceCatalog, 'getVisibleRoots'>
    load: Pick<FileSystemLoadState, 'activeError' | 'activeStatus'>
    operationItems: ResourceOperationItems
    operations: FileSystemItemDragDropOperations
    paths: Pick<FileSystemPaths, 'getVisibleItemLinkPath'>
    permissions: Pick<FileSystemPermissions, 'canCreateItems' | 'canEdit' | 'canManageFolders'>
  }
  navigation: Pick<WorkspaceNavigation, 'openItem'>
}

type WorkspaceRuntimeExternalFileDropCapability = { status: 'enabled' } | { status: 'disabled' }

export function WorkspaceRuntimeDndProvider({
  children,
  externalFiles = { status: 'disabled' },
  runtime,
  workspaceName,
}: {
  children: ReactNode
  externalFiles?: WorkspaceRuntimeExternalFileDropCapability
  runtime: RuntimeDndInput
  workspaceName: string | null
}) {
  const filesystem = runtime.filesystem
  const sidebarWorkspace = useSidebarWorkspaceState()
  const { handleDrop: handleDropFiles } = useFileDropHandler(filesystem, {
    openItem: async (itemId, options) => {
      await runtime.navigation.openItem(itemId, options)
    },
    revealItem: (itemId: ResourceId) => {
      revealSidebarItemParents({
        catalog: filesystem.catalog,
        itemId,
        uiCommands: sidebarWorkspace.uiCommands,
      })
    },
  })
  const dropPlanningCapabilities = {
    canCreateRootItems: filesystem.permissions.canCreateItems,
    canManageFolders: filesystem.permissions.canManageFolders,
  }
  const externalFileDropCapability: DndExternalFileDropCapability =
    externalFiles.status === 'enabled' && filesystem.permissions.canCreateItems
      ? { status: 'enabled', handleDropFiles }
      : createDisabledExternalFileDropCapability()

  return (
    <DndRuntimeProvider
      catalog={filesystem.catalog}
      dndContext={{
        executeFileSystemCommand: async (command) => {
          return filesystem.operations.executeDropCommand(command)
        },
        openItem: async (item) => {
          await runtime.navigation.openItem(item.id)
        },
      }}
      dropPlanningContext={{
        workspaceId: null,
        workspaceName,
        ...dropPlanningCapabilities,
      }}
      externalFiles={externalFileDropCapability}
      operationItems={filesystem.operationItems}
      paths={filesystem.paths}
    >
      {children}
    </DndRuntimeProvider>
  )
}
