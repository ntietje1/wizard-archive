import type { Id } from 'convex/_generated/dataModel'
import {
  DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
  DEFAULT_CANVAS_NODE_BORDER_STROKE,
  readCanvasNodeBorderWidth,
  readCanvasNodeSurfaceColor,
  readCanvasNodeSurfaceOpacity,
} from '../shared/canvas-node-surface-style'
import type { CanvasNodeSurfaceStyleData } from '../shared/canvas-node-surface-style'

export interface EmbedNodeData extends Record<string, unknown>, CanvasNodeSurfaceStyleData {
  sidebarItemId?: Id<'sidebarItems'>
  lockedAspectRatio?: number
}

function readSidebarItemId(value: unknown): Id<'sidebarItems'> | undefined {
  return typeof value === 'string' && value.length > 0 ? (value as Id<'sidebarItems'>) : undefined
}

function readLockedAspectRatio(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

export function parseEmbedNodeData(data: Record<string, unknown>): EmbedNodeData {
  const backgroundColor = readCanvasNodeSurfaceColor(data.backgroundColor)
  const borderStroke = readCanvasNodeSurfaceColor(data.borderStroke)

  return {
    sidebarItemId: readSidebarItemId(data.sidebarItemId),
    lockedAspectRatio: readLockedAspectRatio(data.lockedAspectRatio),
    backgroundColor: backgroundColor ?? DEFAULT_CANVAS_NODE_BACKGROUND_COLOR,
    backgroundOpacity: readCanvasNodeSurfaceOpacity(data.backgroundOpacity),
    borderStroke: borderStroke ?? DEFAULT_CANVAS_NODE_BORDER_STROKE,
    borderOpacity: readCanvasNodeSurfaceOpacity(data.borderOpacity),
    borderWidth: readCanvasNodeBorderWidth(data.borderWidth),
  }
}
