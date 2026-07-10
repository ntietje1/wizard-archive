import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'

export interface ResourceImportFile {
  name: string
  contentType: string
  size: number
  arrayBuffer: () => MaybePromise<ArrayBuffer>
  text: () => MaybePromise<string>
}

export interface ResourceImportContentInitializers {
  initializeImportedFile: (input: {
    file: ResourceImportFile
    fileId: SidebarItemId
    onProgress?: (percentage: number) => void
  }) => MaybePromise<ResourceOperationResult>
  initializeImportedTextFile: (input: {
    file: ResourceImportFile
    noteId: SidebarItemId
  }) => MaybePromise<void>
}
