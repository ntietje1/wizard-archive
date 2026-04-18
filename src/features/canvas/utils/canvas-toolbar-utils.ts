import type { Node } from '@xyflow/react'

export type CanvasTool =
  | 'select'
  | 'hand'
  | 'draw'
  | 'erase'
  | 'lasso'
  | 'rectangle'
  | 'text'
  | 'sticky'

export const TOOL_SETTINGS_TOOLS = ['draw', 'rectangle'] as const satisfies ReadonlyArray<CanvasTool>

export type CanvasToolWithSettings = (typeof TOOL_SETTINGS_TOOLS)[number]

export const MAIN_TOOLBAR_ORDER = [
  'select',
  'hand',
  'lasso',
  'draw',
  'erase',
  'text',
  'sticky',
  'rectangle',
] as const satisfies ReadonlyArray<CanvasTool>

export const VIEWPORT_HISTORY_ORDER = [
  'zoom-in',
  'zoom-out',
  'fit-zoom',
  'undo',
  'redo',
] as const

const ONE_SHOT_TOOLS = ['lasso', 'text', 'sticky', 'rectangle'] as const satisfies ReadonlyArray<CanvasTool>
const COLOR_EDITABLE_NODE_TYPES = new Set(['sticky', 'rectangle', 'stroke'])

const TOOL_SETTINGS_SET = new Set<CanvasToolWithSettings>(TOOL_SETTINGS_TOOLS)
const ONE_SHOT_TOOL_SET = new Set<CanvasTool>(ONE_SHOT_TOOLS)

const TOOL_CURSORS: Record<CanvasTool, string | undefined> = {
  select: undefined,
  hand: 'grab',
  draw: 'crosshair',
  erase: 'cell',
  lasso: 'crosshair',
  rectangle: 'crosshair',
  text: 'copy',
  sticky: 'copy',
}

export function getToolCursor(tool: CanvasTool): string | undefined {
  return TOOL_CURSORS[tool]
}

export function shouldResetToolAfterAction(tool: CanvasTool): boolean {
  return ONE_SHOT_TOOL_SET.has(tool)
}

export function isCanvasToolWithSettings(tool: CanvasTool): tool is CanvasToolWithSettings {
  return TOOL_SETTINGS_SET.has(tool as CanvasToolWithSettings)
}

export type CanvasConditionalToolbarState =
  | { kind: 'hidden' }
  | { kind: 'tool'; tool: CanvasToolWithSettings }
  | { kind: 'selection'; node: Node }

export function getCanvasConditionalToolbarState(
  activeTool: CanvasTool,
  selectedNodes: Array<Node>,
): CanvasConditionalToolbarState {
  if (selectedNodes.length === 1) {
    const [node] = selectedNodes
    if (COLOR_EDITABLE_NODE_TYPES.has(node.type ?? '') && node.data?.color) {
      return { kind: 'selection', node }
    }
    return { kind: 'hidden' }
  }

  if (selectedNodes.length > 1) {
    return { kind: 'hidden' }
  }

  if (isCanvasToolWithSettings(activeTool)) {
    return { kind: 'tool', tool: activeTool }
  }

  return { kind: 'hidden' }
}
