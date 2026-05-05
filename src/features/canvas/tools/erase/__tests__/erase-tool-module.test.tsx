import { afterEach, describe, expect, it, vi } from 'vitest'
import { eraseToolSpec } from '../erase-tool-module'
import { clearEraseToolLocalOverlay } from '../erase-tool-local-overlay'
import { createMockCanvasToolRuntime } from '../../__tests__/helpers/create-mock-canvas-tool-runtime'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

describe('eraseToolSpec', () => {
  afterEach(() => {
    clearEraseToolLocalOverlay()
  })

  it('deletes only stroke nodes intersected by the erase trail', () => {
    const deleteNodes = vi.fn()
    const controller = eraseToolSpec.createHandlers(
      createEraseRuntime({
        deleteNodes,
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
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 40, clientY: 40 }))

    expect(deleteNodes).toHaveBeenCalledWith(new Set(['hit-stroke']))
  })

  it('releases pointer capture and does not delete on cancel', () => {
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

    expect(deleteNodes).not.toHaveBeenCalled()
    expect(releasePointerCapture).toHaveBeenCalledWith(1)
  })
})

function createEraseRuntime(options: {
  deleteNodes: (nodeIds: ReadonlySet<string>) => void
  nodes: Array<CanvasDocumentNode>
}) {
  return createMockCanvasToolRuntime(options)
}

function createStrokeNode(id: string, points: Array<[number, number, number]>): CanvasDocumentNode {
  return {
    id,
    type: 'stroke',
    position: { x: 0, y: 0 },
    width: 120,
    height: 40,
    data: {
      points,
      color: '#000',
      size: 8,
      opacity: 100,
      bounds: { x: 0, y: 0, width: 120, height: 40 },
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
