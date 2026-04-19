import type { Id } from 'convex/_generated/dataModel'

export type EmbedNodeData = { sidebarItemId?: Id<'sidebarItems'> }

function readSidebarItemId(value: unknown): Id<'sidebarItems'> | undefined {
  return typeof value === 'string' && value.length > 0 ? (value as Id<'sidebarItems'>) : undefined
}

export function parseEmbedNodeData(data: Record<string, unknown>): EmbedNodeData {
  return {
    sidebarItemId: readSidebarItemId(data.sidebarItemId),
  }
}
