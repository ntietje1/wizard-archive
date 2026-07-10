import type {
  FileSystemClipboardOperations,
  FileSystemItemContextMenuOperations,
  FileSystemItemCreateValidationOperations,
  FileSystemItemDragDropOperations,
} from './item-operation-contracts'
import type { ResourceHistoryOperationDriver } from './operation-runtime-contract'

export type FileSystemOperations = FileSystemItemContextMenuOperations &
  FileSystemItemDragDropOperations &
  FileSystemItemCreateValidationOperations & {
    clipboard: FileSystemClipboardOperations
    history: ResourceHistoryOperationDriver
  }
