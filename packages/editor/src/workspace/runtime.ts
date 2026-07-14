import type { MaybePromise } from '../../../../shared/common/async'
import type {
  CanvasEmbeddedSessionPorts,
  CanvasSessionPorts,
} from '../canvas/workspace-session-source'
import type { PreviewUploadCapability } from '../files/preview-upload-contract'
import type { FileSession } from '../files/session-contract'
import type { ResourceAvailabilityState } from '../filesystem/domain/availability-state'
import type { WorkspaceFileSystem } from '../filesystem/filesystem'
import { createCurrentItemFileSystemSelection } from '../filesystem/selection'
import type { MapSession } from '../game-maps/session-contract'
import type {
  NoteHeadingSessionPorts,
  NotePlaybackSessionPorts,
  NoteSessionPorts,
  NoteValueSessionPorts,
} from '../notes/workspace-session-source'
import type { AnyItem, AnyItemWithContent } from './items'
import type { ResourceId } from '../resources/domain-id'

declare const resourceUriBrand: unique symbol
const WORKSPACE_RESOURCE_URI_PREFIX = 'resource:'
const SAFE_EXTERNAL_URL_PROTOCOLS = new Set(['http:', 'https:'])

type ResourceUri = string & {
  readonly [resourceUriBrand]: true
}

export interface WorkspaceResource {
  kind: 'resource'
  uri: ResourceUri
}

export interface WorkspaceNavigation {
  canOpenItemsSeparately: WorkspaceNavigationCapability
  current: WorkspaceNavigationState
  openCreateDashboard: () => MaybePromise<WorkspaceNavigationResult>
  openDefaultItem: () => MaybePromise<WorkspaceNavigationResult>
  openItem: (
    resource: WorkspaceResource,
    options?: WorkspaceNavigationOptions,
  ) => MaybePromise<WorkspaceNavigationResult>
  openExternalUrl: (url: string) => MaybePromise<WorkspaceNavigationResult>
  openTrash: () => MaybePromise<WorkspaceNavigationResult>
}

type WorkspaceNavigationCapability =
  | { status: 'available' }
  | { status: 'unsupported'; reason: string }

type WorkspaceNavigationTarget = 'current' | 'separate'

type WorkspaceNavigationOptions = {
  heading?: string
  replace?: boolean
  target?: WorkspaceNavigationTarget
}

export type WorkspaceNavigationResult =
  | { status: 'completed' }
  | { status: 'unavailable'; reason: string }

export type WorkspaceNavigationState =
  | {
      kind: 'create'
    }
  | {
      kind: 'empty'
    }
  | {
      kind: 'resource'
      resource: WorkspaceResource | null
    }
  | {
      kind: 'trash'
    }

export function createWorkspaceResource(resourceId: ResourceId): WorkspaceResource {
  return {
    kind: 'resource',
    uri: `${WORKSPACE_RESOURCE_URI_PREFIX}${resourceId}` as ResourceUri,
  }
}

export function getWorkspaceResourceId(resource: WorkspaceResource): ResourceId {
  if (!resource.uri.startsWith(WORKSPACE_RESOURCE_URI_PREFIX)) {
    throw new Error(
      `Unsupported workspace resource URI: ${resource.uri}. Expected ${WORKSPACE_RESOURCE_URI_PREFIX}<resourceId>`,
    )
  }
  return resource.uri.slice(WORKSPACE_RESOURCE_URI_PREFIX.length) as ResourceId
}

export function getWorkspaceNavigationCurrentResourceId({
  current,
}: Pick<WorkspaceNavigation, 'current'>): ResourceId | null {
  return current.kind === 'resource' && current.resource
    ? getWorkspaceResourceId(current.resource)
    : null
}

export function resolveWorkspaceNavigationState({
  canCreateDashboard,
  isResourceRequested,
  isWorkspaceLoaded,
  resource,
  trashRequested,
}: {
  canCreateDashboard: boolean
  isResourceRequested: boolean
  isWorkspaceLoaded: boolean
  resource: WorkspaceResource | null
  trashRequested: boolean
}): WorkspaceNavigationState {
  if (trashRequested) return { kind: 'trash' }
  if (isResourceRequested) return { kind: 'resource', resource }
  if (!isWorkspaceLoaded) return { kind: 'empty' }
  return canCreateDashboard ? { kind: 'create' } : { kind: 'empty' }
}

export interface WorkspaceRuntime {
  workspace: {
    id: string
    instanceId: string
  }
  filesystem: WorkspaceFileSystem
  navigation: WorkspaceNavigation
  sessions: WorkspaceSessions
}

interface WorkspaceSessions {
  canvas: CanvasSessionPorts
  canvasEmbedded: CanvasEmbeddedSessionPorts
  canvasPreviewUpload: PreviewUploadCapability
  file: FileSession
  map: MapSession
  note: NoteSessionPorts
  noteHeadings: NoteHeadingSessionPorts
  notePlayback: NotePlaybackSessionPorts
  noteValues: NoteValueSessionPorts
}

export interface CurrentItemState {
  item: AnyItem | null
  contentItem: AnyItemWithContent | null
  availabilityState: ResourceAvailabilityState
}

type WorkspaceFileSystemSource = Omit<WorkspaceFileSystem, 'selection'>

export function createWorkspaceRuntime({
  filesystem,
  navigation,
  sessions,
  workspaceInstanceId,
  workspaceId,
}: {
  filesystem: WorkspaceFileSystemSource
  navigation: WorkspaceNavigation
  sessions: WorkspaceSessions
  workspaceInstanceId?: string
  workspaceId: string
}): WorkspaceRuntime {
  return {
    workspace: {
      id: workspaceId,
      instanceId: workspaceInstanceId ?? workspaceId,
    },
    filesystem: {
      ...filesystem,
      selection: createCurrentItemFileSystemSelection(filesystem.current.item),
    },
    navigation: createSafeWorkspaceNavigation(navigation),
    sessions,
  }
}

function createSafeWorkspaceNavigation(navigation: WorkspaceNavigation): WorkspaceNavigation {
  return {
    ...navigation,
    openExternalUrl: (url) => {
      const safeUrl = parseSafeExternalUrl(url)
      if (safeUrl.status !== 'completed') return safeUrl
      return navigation.openExternalUrl(safeUrl.url)
    },
  }
}

function parseSafeExternalUrl(
  url: string,
): { status: 'completed'; url: string } | { status: 'unavailable'; reason: string } {
  try {
    const externalUrl = new URL(url)
    return SAFE_EXTERNAL_URL_PROTOCOLS.has(externalUrl.protocol)
      ? { status: 'completed', url: externalUrl.toString() }
      : { status: 'unavailable', reason: 'unsafe_external_url' }
  } catch {
    return { status: 'unavailable', reason: 'invalid_external_url' }
  }
}
