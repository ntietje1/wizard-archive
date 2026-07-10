import type { RemoteHighlight, RemoteUser } from '../../utils/canvas-awareness-types'

export function getRemoteResizeDimensions(remoteUsers: Array<RemoteUser>) {
  return mergeRemoteStates(remoteUsers, (remoteUser) => remoteUser.resizing)
}

export function getRemoteNodeHighlights(remoteUsers: Array<RemoteUser>) {
  return new Map(Object.entries(mergeRemoteStates(remoteUsers, getRemoteNodeHighlightState)))
}

function getRemoteHighlightNodeIds(remoteUser: RemoteUser): Array<string> | null {
  if (remoteUser.resizing) {
    return Object.keys(remoteUser.resizing)
  }

  return remoteUser.selection?.nodeIds ?? null
}

function getRemoteNodeHighlightState(
  remoteUser: RemoteUser,
): Record<string, RemoteHighlight> | null {
  const nodeIds = getRemoteHighlightNodeIds(remoteUser)
  return createRemoteHighlightState(remoteUser, nodeIds)
}

export function getRemoteEdgeHighlights(remoteUsers: Array<RemoteUser>) {
  return new Map(
    Object.entries(
      mergeRemoteStates(remoteUsers, (remoteUser) =>
        createRemoteHighlightState(remoteUser, remoteUser.selection?.edgeIds ?? null),
      ),
    ),
  )
}

function createRemoteHighlightState(
  remoteUser: RemoteUser,
  itemIds: Array<string> | null,
): Record<string, RemoteHighlight> | null {
  if (!itemIds) return null

  const highlight = {
    color: remoteUser.user.color,
    name: remoteUser.user.name,
  }
  return Object.fromEntries(itemIds.map((itemId) => [itemId, highlight]))
}

function mergeRemoteStates<TValue>(
  remoteUsers: Array<RemoteUser>,
  readState: (remoteUser: RemoteUser) => Record<string, TValue> | null | undefined,
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

  return merged ?? {}
}
