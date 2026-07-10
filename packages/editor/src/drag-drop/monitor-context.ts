import type { AnyItem } from '../workspace/items'
import type { FileSystemExecutableDropCommand } from '../filesystem/drop-planner'
import type { ResourceOperationItems } from '../filesystem/catalog'
import type { ResourceCommandResult } from '../filesystem/transaction-contract'
import type { DropPlanningContext } from './planning-context'
import type { DropTargetCatalog } from './drop-target-data'

export interface DndExecutionContext {
  executeFileSystemCommand: (
    command: FileSystemExecutableDropCommand,
  ) => Promise<ResourceCommandResult>
  openItem: (item: AnyItem) => Promise<void>
}

export interface ElementDragMonitorContext {
  catalog: DropTargetCatalog
  dndContext: DndExecutionContext
  dropPlanningContext: DropPlanningContext
  operationItems: ResourceOperationItems
  runtimeId?: string
}
