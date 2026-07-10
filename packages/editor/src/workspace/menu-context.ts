import type { AnyItem } from './items'
import type { PermissionLevel } from 'shared/permissions/types'
import type { VIEW_CONTEXT } from './view-context'

export type ViewContext = (typeof VIEW_CONTEXT)[keyof typeof VIEW_CONTEXT]

export interface WorkspaceMenuContext {
  surface: ViewContext
  /** Item under the context-click target, when the menu opened on a concrete item. */
  item?: AnyItem
  /**
   * Main selected item for commands. When selectedItems is non-empty, this should be the first
   * selected item unless explicitly set to another item inside selectedItems.
   */
  primaryItem?: AnyItem
  /**
   * Ordered full item objects for the active selection. An empty array means the selection surface
   * is active but empty. primaryItem must not point outside this array when the array is non-empty.
   */
  selectedItems: Array<AnyItem>
  permissionLevel?: PermissionLevel
  rootOperations?: {
    canDownloadAll: boolean
  }
  domainContext?: unknown
}

export type Predicate = (context: WorkspaceMenuContext) => boolean
