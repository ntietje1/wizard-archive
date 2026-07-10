import { describe, expect, it, vi } from 'vite-plus/test'
import { eraseToolSpec } from '../erase-tool-module'
import { createMockCanvasToolRuntime } from '../../__tests__/helpers/create-mock-canvas-tool-runtime'
import { createCanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'
import { getStrokeBounds } from '../../../nodes/stroke/stroke-node-model'
import type { CanvasDocumentNode } from '../../../document-contract'
import type { CanvasToolLocalOverlayStore } from '../../../stores/canvas-tool-local-overlay-store'

const STROKE_SIZE = 8

describe('eraseToolSpec', () => {
  it('shows live feedback and deletes only stroke nodes intersected by the erase trail', async () => {
    const deleteNodes = vi.fn()
    const localOverlayStore = createCanvasToolLocalOverlayStore()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
        localOverlayStore,
        nodes: [
          createStrokeNode('hit-stroke', [
            [10, 10, 0.5],
            [100, 10, 0.5],
          ]),
          createStrokeNode('missed-stroke', [
            [10, 120, 0.5],
            [100, 120, 0.5],
          ]),
          {
            id: 'text-node',
            type: 'text',
            position: { x: 0, y: 0 },
            data: {},
          },
        ],
      }),
    )
    const { element: target, setPointerCapture } = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 40, clientY: 0 }))
    expect(setPointerCapture).toHaveBeenCalledWith(1)
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    await nextAnimationFrame()

    expect(localOverlayStore.getState().eraseErasingStrokeIds).toEqual(new Set(['hit-stroke']))

    controller.onPointerUp?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    expect(deleteNodes).toHaveBeenCalledWith(new Set(['hit-stroke']))
  })

  it('releases pointer capture on cancel', () => {
    const deleteNodes = vi.fn()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
        nodes: [
          createStrokeNode('hit-stroke', [
            [10, 10, 0.5],
            [100, 10, 0.5],
          ]),
        ],
      }),
    )
    const { element: target, releasePointerCapture } = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 40, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))
    controller.onPointerCancel?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    expect(releasePointerCapture).toHaveBeenCalledWith(1)
    expect(deleteNodes).not.toHaveBeenCalled()
  })

  it('keeps erasing bound to the initiating pointer', () => {
    const deleteNodes = vi.fn()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
        nodes: [
          createStrokeNode('hit-stroke', [
            [10, 10, 0.5],
            [100, 10, 0.5],
          ]),
        ],
      }),
    )
    const { element: target } = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 40, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))
    controller.onPointerDown?.(
      createPointerEvent(target, { clientX: 200, clientY: 200, pointerId: 2 }),
    )
    controller.onPointerMove?.(
      createPointerEvent(target, { clientX: 220, clientY: 220, pointerId: 2 }),
    )
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    expect(deleteNodes).toHaveBeenCalledWith(new Set(['hit-stroke']))
  })

  it('preserves untested erase trail segments until intersections are checked', () => {
    const deleteNodes = vi.fn()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
        nodes: [
          createStrokeNode('early-hit-stroke', [
            [5, -20, 0.5],
            [5, 20, 0.5],
          ]),
        ],
      }),
    )
    const { element: target } = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 10, clientY: 0 }))
    for (let offset = 0; offset < 250; offset += 1) {
      controller.onPointerMove?.(
        createPointerEvent(target, { clientX: 100 + offset, clientY: 100 }),
      )
    }
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 350, clientY: 100 }))

    expect(deleteNodes).toHaveBeenCalledWith(new Set(['early-hit-stroke']))
  })
})

function createEraseRuntime(options: {
  deleteNodes: (nodeIds: ReadonlySet<string>) => void
  localOverlayStore?: CanvasToolLocalOverlayStore
  nodes: Array<CanvasDocumentNode>
}) {
  return createMockCanvasToolRuntime(options)
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

function createStrokeNode(id: string, points: Array<[number, number, number]>): CanvasDocumentNode {
  const bounds = getStrokeBounds(points, STROKE_SIZE)

  return {
    id,
    type: 'stroke',
    position: { x: bounds.x, y: bounds.y },
    width: bounds.width,
    height: bounds.height,
    data: {
      points,
      color: '#000',
      size: STROKE_SIZE,
      opacity: 100,
      bounds,
    },
  }
}

function createPointerTarget() {
  const element = document.createElement('div')
  const setPointerCapture = vi.fn()
  const releasePointerCapture = vi.fn()
  element.setPointerCapture = setPointerCapture
  element.releasePointerCapture = releasePointerCapture
  return { element, setPointerCapture, releasePointerCapture }
}

function createPointerEvent(
  target: Element,
  overrides: Partial<PointerEvent> & { clientX: number; clientY: number },
): PointerEvent {
  return {
    button: 0,
    buttons: 1,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target,
    ...overrides,
  } as PointerEvent
}
