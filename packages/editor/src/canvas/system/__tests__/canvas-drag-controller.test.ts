import { describe, expect, it, vi } from 'vite-plus/test'
import { createCanvasDragController } from '../canvas-drag-controller'
import { createCanvasEngine } from '../canvas-engine'
import type { CanvasDocumentNode as Node } from '../../document-contract'

describe('createCanvasDragController', () => {
  it('resolves the final release position before ending a drag session', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [createNode('node-1')] })
    const onEnd = vi.fn()
    const controller = createController(engine, { onEnd })

    controller.begin('node-1', createMouseEvent('mousedown', 0, 0))
    controller.update(createMouseEvent('mousemove', 10, 0))
    controller.commit(createMouseEvent('mouseup', 30, 0))

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd.mock.calls[0]?.[0].resolvedPositions.get('node-1')).toEqual({ x: 30, y: 0 })

    controller.destroy()
    engine.destroy()
  })

  it('ends an active engine drag when destroyed', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [createNode('node-1')] })
    const controller = createController(engine)

    controller.begin('node-1', createMouseEvent('mousedown', 0, 0))
    controller.update(createMouseEvent('mousemove', 10, 0))
    expect(engine.getSnapshot().nodeLookup.get('node-1')?.dragging).toBe(true)

    controller.destroy()

    expect(engine.getSnapshot().nodeLookup.get('node-1')?.dragging).toBe(false)

    engine.destroy()
  })

  it('reverts active drag positions and reports the cancelled start state once', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [createNode('node-1')] })
    const onCancel = vi.fn()
    const controller = createController(engine, { onCancel })

    controller.begin('node-1', createMouseEvent('mousedown', 0, 0))
    controller.update(createMouseEvent('mousemove', 25, 10))
    controller.cancel(createMouseEvent('pointercancel', 25, 10))

    expect(engine.getSnapshot().nodeLookup.get('node-1')?.node.position).toEqual({ x: 0, y: 0 })
    expect(engine.getSnapshot().nodeLookup.get('node-1')?.dragging).toBe(false)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCancel.mock.calls[0]?.[0].resolvedPositions).toEqual(
      new Map([['node-1', { x: 0, y: 0 }]]),
    )
    expect(onCancel.mock.calls[0]?.[0].final).toBe(false)

    controller.cancel(createMouseEvent('pointercancel', 25, 10))
    expect(onCancel).toHaveBeenCalledTimes(1)

    controller.destroy()
    engine.destroy()
  })

  it('does not replace an active drag session with profiling work', () => {
    const engine = createCanvasEngine()
    engine.setDocumentSnapshot({ nodes: [createNode('node-1')] })
    const onEnd = vi.fn()
    const controller = createController(engine, { onEnd })

    controller.begin('node-1', createMouseEvent('mousedown', 0, 0))
    controller.update(createMouseEvent('mousemove', 10, 0))
    controller.profileDrag({ nodeIds: new Set(['node-1']), delta: { x: 100, y: 0 }, steps: 2 })
    controller.commit(createMouseEvent('mouseup', 20, 0))

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd.mock.calls[0]?.[0].resolvedPositions.get('node-1')).toEqual({ x: 20, y: 0 })

    controller.destroy()
    engine.destroy()
  })
})

function createController(
  engine: ReturnType<typeof createCanvasEngine>,
  callbacks: Parameters<typeof createCanvasDragController>[0]['callbacks'] = {},
) {
  return createCanvasDragController({
    callbacks,
    canvasEngine: engine,
    getCanvasPosition: (point) => point,
    getPrimaryPressed: () => false,
    getSelectedNodeIds: () => new Set(),
    getShiftPressed: () => false,
    getZoom: () => 1,
  })
}

function createNode(id: string): Node {
  return {
    id,
    type: 'text',
    position: { x: 0, y: 0 },
    zIndex: 0,
    data: {},
    width: 100,
    height: 50,
  }
}

function createMouseEvent(type: string, clientX: number, clientY: number) {
  return new MouseEvent(type, {
    button: 0,
    cancelable: true,
    clientX,
    clientY,
  })
}
