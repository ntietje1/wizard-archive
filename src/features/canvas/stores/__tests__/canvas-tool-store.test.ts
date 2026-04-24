import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasToolStore } from '../canvas-tool-store'

describe('useCanvasToolStore', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('changes active tools only when set explicitly', () => {
    const tools = ['draw', 'hand', 'erase', 'lasso', 'text'] as const

    for (const tool of tools) {
      useCanvasToolStore.getState().setActiveTool(tool)
      expect(useCanvasToolStore.getState().activeTool).toBe(tool)
    }
  })

  it('resets tool state back to defaults', () => {
    const store = useCanvasToolStore

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
    useCanvasToolStore.getState().setStrokeSize(0)

    expect(useCanvasToolStore.getState().strokeSize).toBe(0)
  })
})
