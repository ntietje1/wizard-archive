import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasToolStore } from '../canvas-tool-store'

describe('useCanvasToolStore', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('keeps persistent tools active after completion', () => {
    const persistentTools = ['draw', 'hand', 'erase'] as const

    for (const tool of persistentTools) {
      useCanvasToolStore.getState().setActiveTool(tool)
      expect(useCanvasToolStore.getState().activeTool).toBe(tool)
      useCanvasToolStore.getState().completeActiveToolAction()
      expect(useCanvasToolStore.getState().activeTool).toBe(tool)
    }
  })

  it('returns one-shot tools to select after completion', () => {
    const store = useCanvasToolStore
    const oneShotTools = ['lasso', 'text', 'sticky', 'rectangle'] as const

    for (const tool of oneShotTools) {
      store.getState().setActiveTool(tool)
      store.getState().completeActiveToolAction()
      expect(store.getState().activeTool).toBe('select')
    }
  })
})
