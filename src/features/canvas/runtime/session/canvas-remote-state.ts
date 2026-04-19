import type { RemoteHighlight, RemoteUser, ResizingState } from '../../utils/canvas-awareness-types'

const EMPTY_DRAG_POSITIONS: Record<string, { x: number; y: number }> = {}
const EMPTY_RESIZE_DIMENSIONS: ResizingState = {}
const EMPTY_HIGHLIGHTS = new Map<string, RemoteHighlight>()

export function getRemoteDragPositions(remoteUsers: Array<RemoteUser>) {
  return mergeRemoteStates(remoteUsers, 'dragging', EMPTY_DRAG_POSITIONS)
}

export function getRemoteResizeDimensions(remoteUsers: Array<RemoteUser>) {
  return mergeRemoteStates(remoteUsers, 'resizing', EMPTY_RESIZE_DIMENSIONS)
}

export function getRemoteHighlights(remoteUsers: Array<RemoteUser>) {
  const highlights = new Map<string, RemoteHighlight>()
  const owners = new Map<string, number>()

  for (const remoteUser of remoteUsers) {
    const nodeIds = remoteUser.dragging
      ? Object.keys(remoteUser.dragging)
      : remoteUser.resizing
        ? Object.keys(remoteUser.resizing)
        : remoteUser.selectedNodeIds

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

function mergeRemoteStates<TValue>(
  remoteUsers: Array<RemoteUser>,
  key: 'dragging' | 'resizing',
  emptyFallback: Record<string, TValue>,
): Record<string, TValue> {
  let merged: Record<string, TValue> | null = null
  const owners = new Map<string, number>()

  for (const remoteUser of remoteUsers) {
    const remoteState = remoteUser[key] as Record<string, TValue> | null
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
