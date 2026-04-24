import type { RemoteHighlight, RemoteUser, ResizingState } from '../../utils/canvas-awareness-types'

const EMPTY_DRAG_POSITIONS: Record<string, { x: number; y: number }> = {}
const EMPTY_RESIZE_DIMENSIONS: ResizingState = {}
const EMPTY_HIGHLIGHTS = new Map<string, RemoteHighlight>()

export function getRemoteDragPositions(remoteUsers: Array<RemoteUser>) {
  return mergeRemoteStates(remoteUsers, (remoteUser) => remoteUser.dragging, EMPTY_DRAG_POSITIONS)
}

export function getRemoteResizeDimensions(remoteUsers: Array<RemoteUser>) {
  return mergeRemoteStates(
    remoteUsers,
    (remoteUser) => remoteUser.resizing,
    EMPTY_RESIZE_DIMENSIONS,
  )
}

export function getRemoteHighlights(remoteUsers: Array<RemoteUser>) {
  const highlights = new Map<string, RemoteHighlight>()
  const owners = new Map<string, number>()

  for (const remoteUser of remoteUsers) {
    const nodeIds = getRemoteHighlightNodeIds(remoteUser)

    if (!nodeIds) continue

    for (const nodeId of nodeIds) {
      const existingOwner = owners.get(nodeId)
      if (existingOwner === undefined || remoteUser.clientId < existingOwner) {
        highlights.set(nodeId, {
          color: remoteUser.user.color,
          name: remoteUser.user.name,
        })
        owners.set(nodeId, remoteUser.clientId)
      }
    }
  }

  return highlights.size === 0 ? EMPTY_HIGHLIGHTS : highlights
}

function getRemoteHighlightNodeIds(remoteUser: RemoteUser): Array<string> | null {
  if (remoteUser.dragging) {
    return Object.keys(remoteUser.dragging)
  }

  if (remoteUser.resizing) {
    return Object.keys(remoteUser.resizing)
  }

  return remoteUser.selectedNodeIds
}

function mergeRemoteStates<TValue>(
  remoteUsers: Array<RemoteUser>,
  readState: (remoteUser: RemoteUser) => Record<string, TValue> | null | undefined,
  emptyFallback: Record<string, TValue>,
): Record<string, TValue> {
  let merged: Record<string, TValue> | null = null
  const owners = new Map<string, number>()

  for (const remoteUser of remoteUsers) {
    const remoteState = readState(remoteUser)
    if (!remoteState) continue

    for (const [nodeId, value] of Object.entries(remoteState)) {
      const existingOwner = owners.get(nodeId)
      if (existingOwner === undefined || remoteUser.clientId < existingOwner) {
        merged ??= {}
        merged[nodeId] = value
        owners.set(nodeId, remoteUser.clientId)
      }
    }
  }

  return merged ?? emptyFallback
}
