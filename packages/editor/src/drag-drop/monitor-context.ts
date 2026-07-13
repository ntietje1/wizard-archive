import type { AnyItem } from '../workspace/items'
import type { FileSystemIntentCommand } from '../filesystem/domain/intent-planning'
import type { ResourceOperationItems } from '../filesystem/catalog'
import type { ResourceCommandResult } from '../filesystem/transaction-contract'
import type { DropPlanningContext } from './planning-context'
import type { DropTargetCatalog } from './drop-target-data'

export interface DndExecutionContext {
  executeFileSystemCommand: (command: FileSystemIntentCommand) => Promise<ResourceCommandResult>
  openItem: (item: AnyItem) => Promise<void>
}

export interface ElementDragMonitorContext {
  catalog: DropTargetCatalog
  dndContext: DndExecutionContext
  dropPlanningContext: DropPlanningContext
  operationItems: ResourceOperationItems
  runtimeId?: string
}
