import { describe, expect, it, vi } from 'vitest'
import { createCanvasFlowHandlers } from '../use-canvas-flow-handlers'
import type { CanvasDocumentWriter, CanvasToolHandlers } from '../../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'

function createDocumentWriter(): CanvasDocumentWriter {
  return {
    createNode: vi.fn(),
    patchNodeData: vi.fn(),
    patchEdges: vi.fn(),
    resizeNode: vi.fn(),
    deleteNodes: vi.fn(),
    createEdge: vi.fn(),
    deleteEdges: vi.fn(),
    setNodePositions: vi.fn(),
  }
}

function createActiveToolHandlers(): CanvasToolHandlers {
  return {
    onMoveStart: vi.fn(),
    onMoveEnd: vi.fn(),
    onNodeClick: vi.fn(),
    onEdgeClick: vi.fn(),
    onPaneClick: vi.fn(),
  }
}

describe('createCanvasFlowHandlers', () => {
  const node = { id: 'node-1' } as Node
  const edge = { id: 'edge-1' } as Edge

  it('enables delete handlers only when editing in select mode', () => {
    const documentWriter = createDocumentWriter()
    const activeToolHandlers = createActiveToolHandlers()

    const handlers = createCanvasFlowHandlers({
      activeToolHandlers,
      cancelConnectionDraft: vi.fn(),
      canEdit: true,
      cursorPresence: {
        onMouseMove: vi.fn(),
        onMouseLeave: vi.fn(),
      },
      documentWriter,
      getEdgeCreationDefaults: () => ({ type: 'bezier' }),
      isEdgeMode: false,
      isSelectMode: true,
    })

    handlers.onNodesDelete?.([node])
    handlers.onEdgesDelete?.([edge])

    expect(documentWriter.deleteNodes).toHaveBeenCalledWith(new Set(['node-1']))
    expect(documentWriter.deleteEdges).toHaveBeenCalledWith(new Set(['edge-1']))
  })

  it('omits selection handlers when the surface is not editable select mode', () => {
    const handlers = createCanvasFlowHandlers({
      activeToolHandlers: createActiveToolHandlers(),
      cancelConnectionDraft: vi.fn(),
      canEdit: false,
      cursorPresence: {
        onMouseMove: vi.fn(),
        onMouseLeave: vi.fn(),
      },
      documentWriter: createDocumentWriter(),
      getEdgeCreationDefaults: () => ({ type: 'bezier' }),
      isEdgeMode: false,
      isSelectMode: true,
    })

    expect(handlers.onNodesDelete).toBeUndefined()
    expect(handlers.onEdgesDelete).toBeUndefined()
    expect(handlers.onConnect).toBeUndefined()
  })

  it('creates edges and cancels drafts only in edge mode while preserving pane clicks', () => {
    const cancelConnectionDraft = vi.fn()
    const activeToolHandlers = createActiveToolHandlers()
    const documentWriter = createDocumentWriter()

    const handlers = createCanvasFlowHandlers({
      activeToolHandlers,
      cancelConnectionDraft,
      canEdit: true,
      cursorPresence: {
        onMouseMove: vi.fn(),
        onMouseLeave: vi.fn(),
      },
      documentWriter,
      getEdgeCreationDefaults: () => ({ type: 'step' }),
      isEdgeMode: true,
      isSelectMode: false,
    })

    handlers.onConnect?.({
      source: 'node-1',
      target: 'node-2',
      sourceHandle: null,
      targetHandle: null,
    })
    handlers.onPaneClick?.({} as unknown as Parameters<NonNullable<typeof handlers.onPaneClick>>[0])

    expect(documentWriter.createEdge).toHaveBeenCalledWith(
      {
        source: 'node-1',
        target: 'node-2',
        sourceHandle: null,
        targetHandle: null,
      },
      { type: 'step' },
    )
    expect(cancelConnectionDraft).toHaveBeenCalledTimes(1)
    expect(activeToolHandlers.onPaneClick).toHaveBeenCalledTimes(1)
  })
})
