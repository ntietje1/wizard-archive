import { describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasNodeActions } from '../create-canvas-node-actions'
import type { CanvasEngine } from '../../../system/canvas-engine-types'
import type { CanvasDocumentWriter } from '../../../tools/canvas-tool-types'
import type { CanvasSessionRuntime } from '../../session/use-canvas-session-state'

describe('createCanvasNodeActions', () => {
  it('does not preview or commit resize mutations for a read-only runtime', () => {
    const canvasEngine = {
      updateResize: vi.fn(),
    } as unknown as CanvasEngine
    const documentWriter = createDocumentWriterMock()
    const session = {
      awareness: {
        core: {
          setLocalResizing: vi.fn(),
        },
      },
    } as unknown as CanvasSessionRuntime
    const transact = vi.fn((fn: () => void) => fn())
    const actions = createCanvasNodeActions({
      canvasEngine,
      canEdit: false,
      documentWriter,
      session,
      transact,
    })
    const resize = new Map([['node-1', { width: 40, height: 30, position: { x: 5, y: 6 } }]])

    actions.transact?.(() => {
      throw new Error('read-only transaction should not run')
    })
    actions.onResize('node-1', 40, 30, { x: 5, y: 6 })
    actions.onResizeEnd('node-1', 40, 30, { x: 5, y: 6 })
    actions.onResizeMany(resize)
    actions.onResizeManyCancel(resize)
    actions.onResizeManyEnd(resize)

    expect(actions.transact).toBeUndefined()
    expect(transact).not.toHaveBeenCalled()
    expect(canvasEngine.updateResize).not.toHaveBeenCalled()
    expect(session.awareness.core.setLocalResizing).not.toHaveBeenCalled()
    expect(documentWriter.resizeNode).not.toHaveBeenCalled()
    expect(documentWriter.resizeNodes).not.toHaveBeenCalled()
  })
})

function createDocumentWriterMock(): CanvasDocumentWriter {
  return {
    execute: vi.fn((command) => ({
      type: 'completed' as const,
      command: command.type,
      affectedCount: 0,
    })),
    createNode: vi.fn(),
    createNodes: vi.fn(),
    patchNodeData: vi.fn(),
    patchEdges: vi.fn(),
    resizeNode: vi.fn(),
    resizeNodes: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePositions: vi.fn(),
  }
}
