import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSurfaceRuntime } from '../use-canvas-surface-runtime'
import {
  createCanvasDocumentWriter,
  createCanvasSelectionController,
  createCanvasSessionRuntime,
} from '../../__tests__/canvas-runtime-test-utils'
import { testId } from '~/test/helpers/test-id'

const selectionRectSpy = vi.hoisted(() => vi.fn())
const selectionSyncSpy = vi.hoisted(() => vi.fn())
const toolRuntimeSpy = vi.hoisted(() => vi.fn())
const pointerBridgeSpy = vi.hoisted(() => vi.fn())
const wheelSpy = vi.hoisted(() => vi.fn())
const dropIntegrationSpy = vi.hoisted(() => vi.fn())
const flowHandlersSpy = vi.hoisted(() => vi.fn())
const surfaceClickGuardSpy = vi.hoisted(() => vi.fn())
const suppressNextSurfaceClick = vi.hoisted(() => vi.fn())

const flowHandlersMock = vi.hoisted(
  () =>
    ({
      onNodeDragStart: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragStop: vi.fn(),
      onNodesDelete: vi.fn(),
      onEdgesDelete: vi.fn(),
      onConnect: vi.fn(),
      onMoveStart: vi.fn(),
      onMoveEnd: vi.fn(),
      onNodeClick: vi.fn(),
      onEdgeClick: vi.fn(),
      onPaneClick: vi.fn(),
      onMouseMove: vi.fn(),
      onMouseLeave: vi.fn(),
    }) as const,
)

vi.mock('../../selection/use-canvas-selection-rect', () => ({
  useCanvasSelectionRect: selectionRectSpy,
}))

vi.mock('../../selection/use-canvas-selection-sync', () => ({
  useCanvasSelectionSync: selectionSyncSpy,
}))

vi.mock('../use-canvas-tool-runtime', () => ({
  useCanvasToolRuntime: (...args: Array<unknown>) => {
    toolRuntimeSpy(...args)
    return {
      activeToolController: {
        onMoveStart: vi.fn(),
        onMoveEnd: vi.fn(),
        onNodeClick: vi.fn(),
        onEdgeClick: vi.fn(),
        onPaneClick: vi.fn(),
      },
      toolCursor: 'crosshair',
    }
  },
}))

vi.mock('../use-canvas-pointer-bridge', () => ({
  useCanvasPointerBridge: pointerBridgeSpy,
}))

vi.mock('../use-canvas-wheel', () => ({
  useCanvasWheel: wheelSpy,
}))

vi.mock('../use-canvas-drop-integration', () => ({
  useCanvasDropIntegration: (...args: Array<unknown>) => {
    dropIntegrationSpy(...args)
    return {
      dropOverlayRef: { current: null },
      isDropTarget: true,
      isFileDropTarget: false,
    }
  },
}))

vi.mock('../use-canvas-flow-handlers', () => ({
  useCanvasFlowHandlers: (...args: Array<unknown>) => {
    flowHandlersSpy(...args)
    return flowHandlersMock
  },
}))

vi.mock('../use-canvas-surface-click-guard', () => ({
  useCanvasSurfaceClickGuard: (...args: Array<unknown>) => {
    surfaceClickGuardSpy(...args)
    return {
      suppressNextSurfaceClick,
    }
  },
}))

describe('useCanvasSurfaceRuntime', () => {
  beforeEach(() => {
    selectionRectSpy.mockReset()
    selectionSyncSpy.mockReset()
    toolRuntimeSpy.mockReset()
    pointerBridgeSpy.mockReset()
    wheelSpy.mockReset()
    dropIntegrationSpy.mockReset()
    flowHandlersSpy.mockReset()
    surfaceClickGuardSpy.mockReset()
  })

  it('owns surface interaction wiring without carrying shell-only dependencies', () => {
    const session = createCanvasSessionRuntime()
    const selectionController = createCanvasSelectionController()
    const documentWriter = createCanvasDocumentWriter()
    const history = {
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      onSelectionChange: vi.fn(),
    }
    const dragHandlers = {
      onNodeDragStart: vi.fn(),
      onNodeDrag: vi.fn(),
      onNodeDragStop: vi.fn(),
    }
    const cursorPresence = {
      onMouseMove: vi.fn(),
      onMouseLeave: vi.fn(),
    }
    const reactFlowInstance = {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
    }
    const canvasSurfaceRef = { current: document.createElement('div') }

    const { result } = renderHook(() =>
      useCanvasSurfaceRuntime({
        canvasId: testId<'sidebarItems'>('canvas-id'),
        canEdit: true,
        activeToolId: 'select',
        canvasSurfaceRef,
        session,
        selectionController,
        documentWriter,
        history,
        reactFlowInstance,
        dragHandlers,
        cursorPresence,
      }),
    )

    expect(surfaceClickGuardSpy).toHaveBeenCalledWith(canvasSurfaceRef)
    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: {
          suppressNextSurfaceClick,
        },
        enabled: true,
      }),
    )
    expect(selectionSyncSpy).toHaveBeenCalledWith({
      setLocalSelection: session.awareness.core.setLocalSelection,
      onHistorySelectionChange: history.onSelectionChange,
    })
    expect(toolRuntimeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        interaction: {
          suppressNextSurfaceClick,
        },
        commands: documentWriter,
      }),
    )
    expect(pointerBridgeSpy).toHaveBeenCalled()
    expect(wheelSpy).toHaveBeenCalledWith(canvasSurfaceRef)
    expect(dropIntegrationSpy).toHaveBeenCalledWith({
      canvasId: 'canvas-id',
      canEdit: true,
      isSelectMode: true,
      createNode: documentWriter.createNode,
      screenToFlowPosition: reactFlowInstance.screenToFlowPosition,
    })
    expect(flowHandlersSpy).toHaveBeenCalledWith({
      activeToolController: expect.any(Object),
      canEdit: true,
      cursorPresence,
      documentWriter,
      dragHandlers,
      isSelectMode: true,
    })
    expect(result.current.toolCursor).toBe('crosshair')
    expect(result.current.flowHandlers).toBe(flowHandlersMock)
    expect(result.current.dropTarget).toEqual({
      overlayRef: { current: null },
      isTarget: true,
      isFileTarget: false,
    })
  })

  it('disables selection editing behavior when the user cannot edit', () => {
    const { result } = renderHook(() =>
      useCanvasSurfaceRuntime(createSurfaceRuntimeOptions({ canEdit: false })),
    )

    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
    expect(dropIntegrationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: false,
        isSelectMode: true,
      }),
    )
    expect(flowHandlersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: false,
        isSelectMode: true,
      }),
    )
    expect(result.current.toolCursor).toBe('crosshair')
  })

  it('treats non-select tools as non-selection mode even when editing is allowed', () => {
    const { result } = renderHook(() =>
      useCanvasSurfaceRuntime(createSurfaceRuntimeOptions({ activeToolId: 'draw' })),
    )

    expect(selectionRectSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
    expect(dropIntegrationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        isSelectMode: false,
      }),
    )
    expect(flowHandlersSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        canEdit: true,
        isSelectMode: false,
      }),
    )
    expect(result.current.flowHandlers).toBe(flowHandlersMock)
  })
})

function createSurfaceRuntimeOptions(
  overrides: Partial<Parameters<typeof useCanvasSurfaceRuntime>[0]> = {},
): Parameters<typeof useCanvasSurfaceRuntime>[0] {
  const session = createCanvasSessionRuntime()
  const selectionController = createCanvasSelectionController()
  const documentWriter = createCanvasDocumentWriter()
  const history = {
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    onSelectionChange: vi.fn(),
  }
  const dragHandlers = {
    onNodeDragStart: vi.fn(),
    onNodeDrag: vi.fn(),
    onNodeDragStop: vi.fn(),
  }
  const cursorPresence = {
    onMouseMove: vi.fn(),
    onMouseLeave: vi.fn(),
  }
  const reactFlowInstance = {
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    screenToFlowPosition: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y })),
  }

  return {
    canvasId: testId<'sidebarItems'>('canvas-id'),
    canEdit: true,
    activeToolId: 'select',
    canvasSurfaceRef: { current: document.createElement('div') },
    session,
    selectionController,
    documentWriter,
    history,
    reactFlowInstance,
    dragHandlers,
    cursorPresence,
    ...overrides,
  }
}
