import type { ResourceId } from './domain-id'

export type WorkspaceClipboard =
  | Readonly<{ status: 'empty' }>
  | Readonly<{
      status: 'ready'
      operation: 'copy' | 'move'
      resourceIds: ReadonlyArray<ResourceId>
    }>

export const EMPTY_WORKSPACE_CLIPBOARD: WorkspaceClipboard = { status: 'empty' }
