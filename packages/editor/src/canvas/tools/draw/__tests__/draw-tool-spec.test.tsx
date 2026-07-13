import { describe, expect, it, vi } from 'vite-plus/test'
import { drawToolSpec } from '../draw-tool-module'
import { DRAW_TOOL_AWARENESS_NAMESPACE } from '../draw-tool-awareness-namespace'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
import type { CanvasToolRuntime } from '../../canvas-tool-types'
import type { CanvasToolLocalOverlayControls } from '../../../stores/canvas-tool-local-overlay-store'
import { isUuidV7 } from '../../../../resources/domain-id'

type MockPointerTarget = HTMLDivElement & {
  setPointerCapture: (pointerId: number) => void
  releasePointerCapture: (pointerId: number) => void
}

function createPointerTarget() {
  const target = document.createElement('div') as unknown as MockPointerTarget
  target.setPointerCapture = vi.fn()
  target.releasePointerCapture = vi.fn()
  return target
}

function createPointerEvent(
  target: Element,
  overrides: Partial<PointerEvent> & { clientX: number; clientY: number },
): PointerEvent {
  return {
    button: 0,
    buttons: 1,
    pointerId: 1,
    pressure: 0.5,
    target,
    ...overrides,
  } as PointerEvent
}

describe('drawToolSpec', () => {
  it('publishes and clears draw awareness while drawing', () => {
    const createNode = vi.fn()
    const setPresence = vi.fn()
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        localOverlay: localOverlayStore.getState(),
        setPresence,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    expect(localOverlayStore.getState().drawLocalDrawing).toEqual(
      expect.objectContaining({
        points: [[0, 0, 0.5]],
      }),
    )

    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))
    expect(localOverlayStore.getState().drawLocalDrawing).toEqual(
      expect.objectContaining({
        points: [
          [0, 0, 0.5],
          [20, 20, 0.5],
        ],
      }),
    )

    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(setPresence).toHaveBeenCalledWith(
      DRAW_TOOL_AWARENESS_NAMESPACE,
      expect.objectContaining({
        points: [[0, 0, 0.5]],
      }),
    )
    expect(setPresence).toHaveBeenCalledWith(
      DRAW_TOOL_AWARENESS_NAMESPACE,
      expect.objectContaining({
        points: [
          [0, 0, 0.5],
          [20, 20, 0.5],
        ],
      }),
    )
    expect(setPresence).toHaveBeenLastCalledWith(DRAW_TOOL_AWARENESS_NAMESPACE, null)
    expect(localOverlayStore.getState().drawLocalDrawing).toBeNull()
    expect(createNode).toHaveBeenCalledTimes(1)
    expect(isUuidV7(createNode.mock.calls[0]![0].id)).toBe(true)
  })

  it('clears local and remote draw previews when an active stroke is canceled', () => {
    const createNode = vi.fn()
    const setPresence = vi.fn()
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        localOverlay: localOverlayStore.getState(),
        setPresence,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))
    expect(localOverlayStore.getState().drawLocalDrawing).not.toBeNull()

    controller.onPointerCancel?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(localOverlayStore.getState().drawLocalDrawing).toBeNull()
    expect(setPresence).toHaveBeenLastCalledWith(DRAW_TOOL_AWARENESS_NAMESPACE, null)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
    expect(createNode).not.toHaveBeenCalled()
  })

  it('locks stroke creation to a straight axis-aligned line while shift is held', () => {
    const createNode = vi.fn()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
        getShiftPressed: () => true,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 8 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 8 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: [
            [0, 0, 0.5],
            [20, 0, 0.5],
          ],
        }),
      }),
    )
  })

  it('uses the latest tool color and stroke size for the next stroke gesture', () => {
    const createNode = vi.fn()
    const settings = {
      edgeType: 'bezier' as const,
      strokeColor: 'var(--foreground)',
      strokeOpacity: 100,
      strokeSize: 4,
    }
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
        getSettings: () => settings,
      }),
    )
    const target = createPointerTarget()

    settings.strokeColor = 'var(--t-red)'
    settings.strokeSize = 9

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          color: 'var(--t-red)',
          size: 9,
        }),
      }),
    )
  })

  it('keeps the pointer-down stroke settings for the whole gesture', () => {
    const createNode = vi.fn()
    const settings = {
      edgeType: 'bezier' as const,
      strokeColor: 'var(--t-blue)',
      strokeOpacity: 75,
      strokeSize: 4,
    }
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
        getSettings: () => settings,
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    settings.strokeColor = 'var(--t-red)'
    settings.strokeOpacity = 25
    settings.strokeSize = 9
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          color: 'var(--t-blue)',
          opacity: 75,
          size: 4,
        }),
      }),
    )
  })

  it('clamps freehand strokes to a minimum size of 1 even if tool state falls to zero', () => {
    const createNode = vi.fn()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
        getSettings: () => ({
          edgeType: 'bezier',
          strokeColor: 'var(--foreground)',
          strokeOpacity: 100,
          strokeSize: 0,
        }),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          size: 1,
        }),
      }),
    )
  })

  it('preserves explicit zero-pressure samples', () => {
    const createNode = vi.fn()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0, pressure: 0 }))
    controller.onPointerMove?.(
      createPointerEvent(target, { clientX: 20, clientY: 20, pressure: 0 }),
    )
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 40, clientY: 40, pressure: 0 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: [
            [0, 0, 0],
            [20, 20, 0],
            [40, 40, 0],
          ],
        }),
      }),
    )
  })

  it('keeps an active stroke bound to the initiating pointer', () => {
    const createNode = vi.fn()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerDown?.(
      createPointerEvent(target, { clientX: 100, clientY: 100, pointerId: 2 }),
    )
    controller.onPointerMove?.(
      createPointerEvent(target, { clientX: 100, clientY: 100, pointerId: 2 }),
    )
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 10, clientY: 10 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: [
            [0, 0, 0.5],
            [10, 10, 0.5],
            [20, 20, 0.5],
          ],
        }),
      }),
    )
  })

  it('includes the pointer-up coordinate when finalizing a stroke', () => {
    const createNode = vi.fn()
    const controller = drawToolSpec.createHandlers(
      createDrawEnvironment({
        createNode,
        setPresence: vi.fn(),
      }),
    )
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 20, clientY: 20 }))

    expect(createNode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          points: [
            [0, 0, 0.5],
            [20, 20, 0.5],
          ],
        }),
      }),
    )
  })
})

function createDrawEnvironment({
  createNode,
  setPresence,
  getShiftPressed = () => false,
  localOverlay = createCanvasToolLocalOverlayStore().getState(),
  getSettings = () => ({
    edgeType: 'bezier' as const,
    strokeColor: 'var(--foreground)',
    strokeOpacity: 100,
    strokeSize: 4,
  }),
}: {
  createNode: (node: unknown) => void
  setPresence: (namespace: string, value: unknown) => void
  getShiftPressed?: () => boolean
  localOverlay?: CanvasToolLocalOverlayControls
  getSettings?: () => {
    edgeType: 'bezier'
    strokeColor: string
    strokeOpacity: number
    strokeSize: number
  }
}): CanvasToolRuntime {
  return {
    viewport: {
      screenToCanvasPosition: ({ x, y }) => ({ x, y }),
      getZoom: () => 1,
    },
    commands: {
      execute: (command) => ({
        type: 'completed',
        command: command.type,
        affectedCount: 0,
      }),
      createNode,
      createNodes: () => undefined,
      patchNodeData: () => undefined,
      patchEdges: () => undefined,
      resizeNode: () => undefined,
      resizeNodes: () => undefined,
      deleteNodes: () => undefined,
      createEdge: () => undefined,
      deleteEdges: () => undefined,
      setNodePositions: () => undefined,
    },
    query: {
      getNodes: () => [],
      getEdges: () => [],
      getMeasuredNodes: () => [],
    },
    selection: {
      getSnapshot: () => ({ nodeIds: new Set<string>(), edgeIds: new Set<string>() }),
      setSelection: () => undefined,
      clearSelection: () => undefined,
      toggleNode: () => undefined,
      toggleEdge: () => undefined,
      beginGesture: () => undefined,
      setGesturePreview: () => undefined,
      commitGesture: () => undefined,
      cancelGesture: () => undefined,
    },
    interaction: {
      suppressNextSurfaceClick: () => undefined,
    },
    modifiers: {
      getShiftPressed,
      getPrimaryPressed: () => false,
    },
    editSession: {
      editingEmbedId: null,
      setEditingEmbedId: () => undefined,
      pendingEdit: null,
      setPendingEdit: () => undefined,
    },
    toolState: {
      getSettings,
      getActiveTool: () => 'draw',
      setActiveTool: () => undefined,
      setEdgeType: () => undefined,
      setStrokeColor: () => undefined,
      setStrokeSize: () => undefined,
      setStrokeOpacity: () => undefined,
    },
    localOverlay,
    awareness: {
      core: {
        setLocalCursor: () => undefined,
        setLocalResizing: () => undefined,
        setLocalSelection: () => undefined,
      },
      presence: {
        setPresence,
      },
    },
  }
}
