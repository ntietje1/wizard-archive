import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useCanvasToolRuntimeCore } from '../use-canvas-tool-runtime-core'
import type { useCanvasDocumentCommands } from '../document/use-canvas-commands'
import { createCanvasToolLocalOverlayStore } from '../../stores/canvas-tool-local-overlay-store'
import { createCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasContextMenuSource } from '../context-menu/canvas-context-menu-types'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type { CanvasDocumentWriter, CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { CanvasConnection } from '../../types/canvas-domain-types'

const cursorPresenceSpy = vi.hoisted(() => vi.fn())
const contextMenuSpy = vi.hoisted(() => vi.fn())
const toolHandlersSpy = vi.hoisted(() => vi.fn())
const cursorPresenceMock = vi.hoisted(() => ({
  onMouseMove: vi.fn(),
  onMouseLeave: vi.fn(),
}))
const contextMenuMock = vi.hoisted(() => ({ menu: { groups: [], flatItems: [], isEmpty: true } }))
type UseCanvasToolRuntimeOptions = Parameters<typeof useCanvasToolRuntimeCore>[0]
const canvasToolStore = createCanvasToolStore()
const canvasToolLocalOverlayStore = createCanvasToolLocalOverlayStore()

vi.mock('../interaction/use-canvas-cursor-presence', () => ({
  useCanvasCursorPresence: (...args: Array<unknown>) => {
    cursorPresenceSpy(...args)
    return cursorPresenceMock
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

describe('useCanvasToolRuntimeCore', () => {
  beforeEach(() => {
    canvasToolStore.getState().reset()
    cursorPresenceSpy.mockReset()
    contextMenuSpy.mockReset()
    toolHandlersSpy.mockReset()
    canvasToolLocalOverlayStore.getState().reset()
  })

  it('builds tool handlers, context menu, and cursor presence from explicit inputs', () => {
    const harness = createToolRuntimeHarness()
    const { result } = renderHook(() =>
      useCanvasToolRuntimeCore({ ...harness, activeTool: 'select' }),
    )

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
    expect(contextMenuSpy).toHaveBeenCalledWith({
      activeTool: 'select',
      canEdit: true,
      canvasEngine: harness.canvasEngine,
      source: harness.contextMenuSource,
      createNode: expect.any(Function),
      setPendingEdit: harness.session.editSession.setPendingEdit,
      screenToCanvasPosition: harness.viewportController.screenToCanvasPosition,
      selection: harness.selection,
      commands: harness.commands,
    })
    const contextMenuOptions = contextMenuSpy.mock.calls.at(-1)?.[0] as
      | {
          createNode?: (node: Parameters<CanvasDocumentWriter['createNode']>[0]) => void
        }
      | undefined
    const node = {
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    } as Parameters<CanvasDocumentWriter['createNode']>[0]
    contextMenuOptions?.createNode?.(node)
    expect(harness.documentWriter.createNode).toHaveBeenCalledWith(node)
    expect(result.current).toEqual(
      expect.objectContaining({
        contextMenu: contextMenuMock,
        cursorPresence: cursorPresenceMock,
      }),
    )
  })

  it('blocks context menu node creation when editing is disabled', () => {
    const harness = createToolRuntimeHarness()
    renderHook(() => useCanvasToolRuntimeCore({ ...harness, activeTool: 'select', canEdit: false }))

    const contextMenuOptions = contextMenuSpy.mock.calls.at(-1)?.[0] as
      | {
          createNode?: (node: Parameters<CanvasDocumentWriter['createNode']>[0]) => void
        }
      | undefined
    contextMenuOptions?.createNode?.({
      id: 'node-1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: {},
    })

    expect(harness.documentWriter.createNode).not.toHaveBeenCalled()
  })

  it('uses the active tool spec after the active tool changes', () => {
    const harness = createToolRuntimeHarness()
    const { rerender } = renderHook(
      ({ activeTool }) => useCanvasToolRuntimeCore({ ...harness, activeTool }),
      { initialProps: { activeTool: 'select' as UseCanvasToolRuntimeOptions['activeTool'] } },
    )

    rerender({ activeTool: 'edge' as UseCanvasToolRuntimeOptions['activeTool'] })

    expect(toolHandlersSpy).toHaveBeenCalledTimes(2)
    expect(toolHandlersSpy).toHaveBeenNthCalledWith(2, 'edge', expect.any(Object))
  })

  it('creates edges only when the active edge tool can edit', () => {
    const harness = createToolRuntimeHarness()
    canvasToolStore.setState({
      edgeType: 'step',
      strokeColor: '#ff0000',
      strokeOpacity: 40,
      strokeSize: 999,
    })
    const connection: CanvasConnection = { source: 'source', target: 'target' }
    const { result, rerender } = renderHook(
      ({ canEdit }) => useCanvasToolRuntimeCore({ ...harness, activeTool: 'edge', canEdit }),
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

    rerender({ canEdit: true })
    const { result: selectResult } = renderHook(() =>
      useCanvasToolRuntimeCore({ ...harness, activeTool: 'select' }),
    )
    selectResult.current.createEdgeFromConnection(connection)

    expect(harness.documentWriter.createEdge).not.toHaveBeenCalled()
  })

  it.each([
    [0, 0],
    [100, undefined],
    [-20, 0],
    [140, undefined],
    [Number.NaN, undefined],
  ])('normalizes edge opacity percentage %s to %s', (strokeOpacity, expectedOpacity) => {
    const harness = createToolRuntimeHarness()
    canvasToolStore.setState({ strokeOpacity })
    const connection: CanvasConnection = { source: 'source', target: 'target' }
    const { result } = renderHook(() =>
      useCanvasToolRuntimeCore({ ...harness, activeTool: 'edge' }),
    )

    result.current.createEdgeFromConnection(connection)

    const [, defaults] = harness.documentWriter.createEdge.mock.calls[0] ?? []
    expect(Object.hasOwn(defaults?.style ?? {}, 'opacity')).toBe(expectedOpacity !== undefined)
    if (expectedOpacity !== undefined) {
      expect(defaults?.style).toEqual(expect.objectContaining({ opacity: expectedOpacity }))
    }
  })
})

function createToolRuntimeHarness() {
  const documentWriter = {
    createNode: vi.fn(),
    createNodes: vi.fn(),
    createEdge: vi.fn(),
  }
  const harness = {
    canvasEngine: {
      getSnapshot: () => ({ nodes: [], edges: [] }),
    } as unknown as CanvasEngine,
    canEdit: true,
    commands: {} as ReturnType<typeof useCanvasDocumentCommands>,
    contextMenuSource: {
      createItems: vi.fn(() => []),
      getTargetContributors: vi.fn(() => []),
    } satisfies CanvasContextMenuSource,
    documentWriter: documentWriter as typeof documentWriter & CanvasDocumentWriter,
    modifiers: {
      primaryPressed: false,
      shiftPressed: false,
    },
    pointerRouter: {
      interaction: {
        suppressNextSurfaceClick: vi.fn(),
      },
    } as unknown as UseCanvasToolRuntimeOptions['pointerRouter'],
    selection: {
      getSnapshot: vi.fn(() => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() })),
    } as unknown as CanvasSelectionController,
    session: {
      awareness: {
        core: {
          setLocalCursor: vi.fn(),
        },
      },
      editSession: {
        setPendingEdit: vi.fn(),
      },
    } as unknown as UseCanvasToolRuntimeOptions['session'],
    localOverlayStore: canvasToolLocalOverlayStore,
    toolStore: canvasToolStore,
    viewportController: {
      getZoom: () => 1,
      screenToCanvasPosition: vi.fn((point) => point),
    } as unknown as CanvasViewportController,
  } satisfies Omit<UseCanvasToolRuntimeOptions, 'activeTool'>

  return harness
}
