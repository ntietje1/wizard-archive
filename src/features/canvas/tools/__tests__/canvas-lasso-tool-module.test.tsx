import { describe, expect, it, vi } from 'vitest'
import { lassoToolModule } from '../lasso-tool-module'
import type { CanvasToolContextById } from '../canvas-tool-types'

function createPointerTarget() {
  const target = document.createElement('div') as Element & {
    setPointerCapture: ReturnType<typeof vi.fn>
    releasePointerCapture: ReturnType<typeof vi.fn>
  }
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
    target,
    ...overrides,
  } as PointerEvent
}

describe('lassoToolModule', () => {
  it('selects measured nodes enclosed by the lasso path', () => {
    const clearSelection = vi.fn()
    const setNodeSelection = vi.fn()
    const completeActiveToolAction = vi.fn()
    const setLassoPath = vi.fn()
    const setLocalSelecting = vi.fn()

    const runtime: CanvasToolContextById['lasso'] = {
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getMeasuredNodes: () => [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 20, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
      ],
      clearSelection,
      setNodeSelection,
      completeActiveToolAction,
      setLassoPath,
      setLocalSelecting,
    }

    const controller = lassoToolModule.create(runtime)
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(clearSelection).toHaveBeenCalledTimes(1)
    expect(setLassoPath).toHaveBeenCalledTimes(5)
    expect(setLassoPath).toHaveBeenLastCalledWith([])
    expect(setLocalSelecting).toHaveBeenCalledWith(expect.objectContaining({ type: 'lasso' }))
    expect(setLocalSelecting).toHaveBeenLastCalledWith(null)
    expect(setNodeSelection).toHaveBeenCalledWith(['embed-1'])
    expect(completeActiveToolAction).toHaveBeenCalledTimes(1)
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('clears selection when no measured nodes fall inside the lasso', () => {
    const setNodeSelection = vi.fn()
    const controller = lassoToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getMeasuredNodes: () => [
        {
          id: 'outside-node',
          type: 'embed',
          position: { x: 200, y: 200 },
          width: 40,
          height: 40,
          data: {},
        },
      ],
      clearSelection: vi.fn(),
      setNodeSelection,
      completeActiveToolAction: vi.fn(),
      setLassoPath: vi.fn(),
      setLocalSelecting: vi.fn(),
    })
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(setNodeSelection).toHaveBeenCalledWith([])
  })

  it('selects only the measured nodes that are fully enclosed by the lasso', () => {
    const setNodeSelection = vi.fn()
    const controller = lassoToolModule.create({
      screenToFlowPosition: ({ x, y }) => ({ x, y }),
      getMeasuredNodes: () => [
        {
          id: 'inside-node',
          type: 'embed',
          position: { x: 20, y: 20 },
          width: 40,
          height: 40,
          data: {},
        },
        {
          id: 'outside-node',
          type: 'embed',
          position: { x: 200, y: 200 },
          width: 40,
          height: 40,
          data: {},
        },
        {
          id: 'partially-outside-node',
          type: 'embed',
          position: { x: 80, y: 80 },
          width: 40,
          height: 40,
          data: {},
        },
      ],
      clearSelection: vi.fn(),
      setNodeSelection,
      completeActiveToolAction: vi.fn(),
      setLassoPath: vi.fn(),
      setLocalSelecting: vi.fn(),
    })
    const target = createPointerTarget()

    controller.onPointerDown?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 0 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 100, clientY: 100 }))
    controller.onPointerMove?.(createPointerEvent(target, { clientX: 0, clientY: 100 }))
    controller.onPointerUp?.(createPointerEvent(target, { clientX: 0, clientY: 0 }))

    expect(setNodeSelection).toHaveBeenCalledWith(['inside-node'])
  })
})
