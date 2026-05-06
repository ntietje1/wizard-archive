import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasToolRuntime } from '../use-canvas-tool-runtime'
import { useCanvasToolStore } from '../../stores/canvas-tool-store'
import { testId } from '~/test/helpers/test-id'
import type { CanvasConnection } from '../../types/canvas-domain-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'
import * as Y from 'yjs'

const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const dropIntegrationSpy = vi.hoisted(() => vi.fn())
const contextMenuSpy = vi.hoisted(() => vi.fn())
const toolHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceMock = vi.hoisted(() => ({
  onMouseMove: vi.fn(),
  onMouseLeave: vi.fn(),
}))
const contextMenuMock = vi.hoisted(() => ({ menu: { groups: [], flatItems: [], isEmpty: true } }))
const dropTargetMock = vi.hoisted(() => ({
  dropOverlayRef: { current: null },
  isDropTarget: false,
  isFileDropTarget: false,
}))
type UseCanvasToolRuntimeOptions = Parameters<typeof useCanvasToolRuntime>[0]

vi.mock('../interaction/use-canvas-cursor-presence', () => ({
  useCanvasCursorPresence: (...args: Array<unknown>) => {
    cursorPresenceSpy(...args)
    return cursorPresenceMock
  },
}))

vi.mock('../interaction/use-canvas-drop-integration', () => ({
  useCanvasDropIntegration: (...args: Array<unknown>) => {
    dropIntegrationSpy(...args)
    return dropTargetMock
  },
}))

vi.mock('../context-menu/use-canvas-context-menu', () => ({
  useCanvasContextMenu: (...args: Array<unknown>) => {
    contextMenuSpy(...args)
    return contextMenuMock
  },
}))

vi.mock('../../tools/canvas-tool-modules', () => ({
  canvasToolSpecs: {
    select: {
      cursor: undefined,
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('select', runtime)
        return { onNodeClick: vi.fn(), onEdgeClick: vi.fn() }
      },
    },
    edge: {
      cursor: 'crosshair',
      createHandlers: (runtime: unknown) => {
        toolHandlersSpy('edge', runtime)
        return {}
      },
    },
  },
}))

describe('useCanvasToolRuntime', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
    cursorPresenceSpy.mockReset()
    dropIntegrationSpy.mockReset()
    contextMenuSpy.mockReset()
    toolHandlersSpy.mockReset()
  })

  it('builds tool handlers, drop target, context menu, and cursor presence from explicit inputs', () => {
    const harness = createToolRuntimeHarness()
    const { result } = renderHook(() => useCanvasToolRuntime({ ...harness, activeTool: 'select' }))

    expect(toolHandlersSpy).toHaveBeenCalledWith(
      'select',
      expect.objectContaining({
        awareness: harness.session.awareness,
        commands: harness.documentWriter,
        selection: harness.selection,
      }),
    )
    expect(cursorPresenceSpy).toHaveBeenCalledWith({
      screenToCanvasPosition: harness.viewportController.screenToCanvasPosition,
      awareness: harness.session.awareness.core,
    })
    expect(dropIntegrationSpy).toHaveBeenCalledWith({
      canvasId: 'canvas-id',
      canEdit: true,
      isSelectMode: true,
      createNode: harness.documentWriter.createNode,
      screenToCanvasPosition: harness.viewportController.screenToCanvasPosition,
    })
    expect(contextMenuSpy).toHaveBeenCalledWith({
      activeTool: 'select',
      canEdit: true,
      campaignId: 'campaign-id',
      canvasParentId: 'parent-id',
      nodesMap: harness.nodesMap,
      edgesMap: harness.edgesMap,
      createNode: harness.documentWriter.createNode,
      setPendingEditNodeId: harness.session.editSession.setPendingEditNodeId,
      setPendingEditNodePoint: harness.session.editSession.setPendingEditNodePoint,
      screenToCanvasPosition: harness.viewportController.screenToCanvasPosition,
      selection: harness.selection,
      commands: harness.commands,
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        contextMenu: contextMenuMock,
        cursorPresence: cursorPresenceMock,
        dropTarget: dropTargetMock,
      }),
    )
  })

  it('keeps active tool handlers stable across identical rerenders', () => {
    const harness = createToolRuntimeHarness()
    const { result, rerender } = renderHook(() =>
      useCanvasToolRuntime({ ...harness, activeTool: 'select' }),
    )
    const initialHandlers = result.current.activeToolHandlers

    rerender()

    expect(toolHandlersSpy).toHaveBeenCalledTimes(1)
    expect(result.current.activeToolHandlers).toBe(initialHandlers)
  })

  it('recreates handlers when activeTool changes', () => {
    const harness = createToolRuntimeHarness()
    const { result, rerender } = renderHook(
      ({ activeTool }) => useCanvasToolRuntime({ ...harness, activeTool }),
      { initialProps: { activeTool: 'select' as UseCanvasToolRuntimeOptions['activeTool'] } },
    )
    const initialHandlers = result.current.activeToolHandlers

    rerender({ activeTool: 'edge' as UseCanvasToolRuntimeOptions['activeTool'] })

    expect(toolHandlersSpy).toHaveBeenCalledTimes(2)
    expect(toolHandlersSpy).toHaveBeenNthCalledWith(2, 'edge', expect.any(Object))
    expect(result.current.activeToolHandlers).not.toBe(initialHandlers)
  })

  it('creates edges only when the edge tool can edit', () => {
    const harness = createToolRuntimeHarness()
    useCanvasToolStore.setState({
      edgeType: 'step',
      strokeColor: '#ff0000',
      strokeOpacity: 40,
      strokeSize: 999,
    })
    const connection: CanvasConnection = { source: 'source', target: 'target' }
    const { result, rerender } = renderHook(
      ({ canEdit }) => useCanvasToolRuntime({ ...harness, activeTool: 'edge', canEdit }),
      { initialProps: { canEdit: true } },
    )

    result.current.createEdgeFromConnection(connection)

    expect(harness.documentWriter.createEdge).toHaveBeenCalledWith(connection, {
      type: 'step',
      style: {
        stroke: '#ff0000',
        strokeWidth: 999,
        opacity: 0.4,
      },
    })

    harness.documentWriter.createEdge.mockClear()
    rerender({ canEdit: false })
    result.current.createEdgeFromConnection(connection)

    expect(harness.documentWriter.createEdge).not.toHaveBeenCalled()
  })
})

function createToolRuntimeHarness() {
  const doc = new Y.Doc()
  const nodesMap = doc.getMap<CanvasDocumentNode>('nodes')
  const edgesMap = doc.getMap<CanvasDocumentEdge>('edges')
  const harness = {
    campaignId: testId<'campaigns'>('campaign-id'),
    canvasEngine: {
      getSnapshot: () => ({ nodes: [], edges: [] }),
    },
    canvasId: testId<'sidebarItems'>('canvas-id'),
    canvasParentId: testId<'sidebarItems'>('parent-id'),
    canEdit: true,
    commands: {},
    documentWriter: {
      createNode: vi.fn(),
      createEdge: vi.fn(),
    },
    edgesMap,
    modifiers: {
      primaryPressed: false,
      shiftPressed: false,
    },
    nodesMap,
    pointerRouter: {
      interaction: {
        suppressNextSurfaceClick: vi.fn(),
      },
    },
    selection: {
      getSnapshot: vi.fn(() => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })),
    },
    session: {
      awareness: {
        core: {
          setLocalCursor: vi.fn(),
        },
      },
      editSession: {
        setPendingEditNodeId: vi.fn(),
        setPendingEditNodePoint: vi.fn(),
      },
    },
    viewportController: {
      getZoom: () => 1,
      screenToCanvasPosition: vi.fn((point) => point),
    },
  }

  return harness as typeof harness & UseCanvasToolRuntimeOptions
}
