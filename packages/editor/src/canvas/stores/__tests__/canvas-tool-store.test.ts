import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { createCanvasToolStore } from '../canvas-tool-store'

const canvasToolStore = createCanvasToolStore()

describe('canvasToolStore', () => {
  beforeEach(() => {
    canvasToolStore.getState().reset()
  })

  it('exposes a plain store api instead of a render hook', () => {
    expect(typeof canvasToolStore).toBe('object')
    expect(canvasToolStore.getState).toEqual(expect.any(Function))
    expect(canvasToolStore.subscribe).toEqual(expect.any(Function))
  })

  it('changes active tools only when set explicitly', () => {
    const tools = ['draw', 'hand', 'erase', 'lasso', 'text'] as const

    for (const tool of tools) {
      canvasToolStore.getState().setActiveTool(tool)
      expect(canvasToolStore.getState().activeTool).toBe(tool)
    }
  })

  it('resets tool state back to defaults', () => {
    const store = canvasToolStore

    store.getState().setActiveTool('text')
    store.getState().setStrokeColor('#fff')
    store.getState().setStrokeOpacity(30)
    store.getState().setStrokeSize(16)
    store.getState().reset()

    expect(store.getState()).toMatchObject({
      activeTool: 'select',
      strokeColor: 'var(--foreground)',
      strokeOpacity: 100,
      strokeSize: 4,
    })
  })

  it('still allows zero in the shared stroke size state for non-freehand tools', () => {
    canvasToolStore.getState().setStrokeSize(0)

    expect(canvasToolStore.getState().strokeSize).toBe(0)
  })
})
