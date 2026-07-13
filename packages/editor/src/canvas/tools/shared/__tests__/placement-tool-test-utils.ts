import type { CanvasToolId, CanvasToolRuntime } from '../../canvas-tool-types'
import type { CanvasSelectionSnapshot } from '../../../system/canvas-selection'
import type { CanvasDocumentNode } from '../../../document-contract'
import { createMockCanvasToolRuntime } from '../../__tests__/helpers/create-mock-canvas-tool-runtime'
export function createPointerEvent(
  x: number,
  y: number,
  options: Partial<PointerEvent> = {},
): PointerEvent {
  const target = document.createElement('div')
  target.setPointerCapture = () => undefined
  target.releasePointerCapture = () => undefined

  return {
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: target,
    target,
    ...options,
  } as PointerEvent
}

export function createPlacementEnvironment({
  activeTool,
  createNode,
  replaceSelection,
  setPendingEdit,
  setActiveTool,
}: {
  activeTool: CanvasToolId
  createNode: (node: CanvasDocumentNode) => void
  replaceSelection: (selection: CanvasSelectionSnapshot) => void
  setPendingEdit: (pendingEdit: { nodeId: string; point: { x: number; y: number } } | null) => void
  setActiveTool: (tool: CanvasToolId) => void
}): CanvasToolRuntime {
  const runtime = createMockCanvasToolRuntime({ activeTool })

  return {
    ...runtime,
    commands: {
      ...runtime.commands,
      createNode,
    },
    selection: {
      ...runtime.selection,
      setSelection: replaceSelection,
    },
    editSession: {
      ...runtime.editSession,
      setPendingEdit,
    },
    toolState: {
      ...runtime.toolState,
      setActiveTool,
    },
  }
}
