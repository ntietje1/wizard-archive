import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createCanvasInteractionController,
  getCanvasDrawingPoints,
} from '../interaction-controller'
import { createCanvasInteractionRenderStore } from '../interaction-render-store'

describe('createCanvasInteractionRenderStore', () => {
  it('keeps controller geometry synchronous while coalescing continuous renders to a frame', () => {
    const scheduled: { render?: () => void } = {}
    const controller = createCanvasInteractionController()
    const store = createCanvasInteractionRenderStore(controller, (render) => {
      scheduled.render = render
      return () => {
        delete scheduled.render
      }
    })
    const rendered = vi.fn()
    store.subscribe(rendered)
    controller.beginDrawing(4, { x: 0, y: 0 }, 0.5)
    for (let index = 1; index <= 3; index += 1) {
      controller.updateDrawing(4, [[index, index, 0.5]], false)
    }

    const controllerInteraction = controller.get().interaction
    expect(controllerInteraction.type).toBe('drawing')
    if (controllerInteraction.type !== 'drawing') throw new Error('Expected drawing interaction')
    expect(getCanvasDrawingPoints(controllerInteraction).at(-1)).toEqual([3, 3, 0.5])
    expect(rendered).toHaveBeenCalledTimes(1)

    scheduled.render?.()
    const renderedInteraction = store.get().interaction
    expect(renderedInteraction.type).toBe('drawing')
    if (renderedInteraction.type !== 'drawing') throw new Error('Expected rendered drawing')
    expect(getCanvasDrawingPoints(renderedInteraction).at(-1)).toEqual([3, 3, 0.5])
    expect(rendered).toHaveBeenCalledTimes(2)

    controller.commitDrawing(4)
    expect(store.get().interaction).toEqual({ type: 'idle' })
    expect(rendered).toHaveBeenCalledTimes(3)
    store.dispose()
    controller.dispose()
  })
})
