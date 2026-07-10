import type { ResourceCatalog, ResourceOperationItems } from './catalog'
import type { FileSystemOperations } from './operations'
import type { WizardEditorSharingSource } from '../sharing/contracts'
import type { FileSystemDownload } from './download'
import type { ResourceHistory } from './history-types'
import type { FileSystemSearch } from './search'
import type { ResourceContentSource } from './resource-content-source'
import type { CurrentItemState } from '../workspace/runtime'
import type { FileSystemPaths } from './catalog-paths'
import type { FileSystemLoadState } from './load-state'
import type { FileSystemSelection } from './selection'
import type { FileSystemPermissions } from './permissions'

export interface WorkspaceFileSystem {
  catalog: ResourceCatalog
  operationItems: ResourceOperationItems
  paths: FileSystemPaths
  load: FileSystemLoadState
  current: CurrentItemState
  operations: FileSystemOperations
  selection: FileSystemSelection
  permissions: FileSystemPermissions
  search: FileSystemSearch
  resourceContent: ResourceContentSource
  download: FileSystemDownload
  history: ResourceHistory
  sharing: WizardEditorSharingSource
}
