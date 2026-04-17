import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasToolStore } from '../canvas-tool-store'

describe('useCanvasToolStore', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('keeps draw and erase active after completion', () => {
    const store = useCanvasToolStore.getState()

    store.setActiveTool('draw')
    store.completeActiveToolAction()
    expect(useCanvasToolStore.getState().activeTool).toBe('draw')

    useCanvasToolStore.getState().setActiveTool('erase')
    useCanvasToolStore.getState().completeActiveToolAction()
    expect(useCanvasToolStore.getState().activeTool).toBe('erase')
  })

  it('returns one-shot tools to pointer after completion', () => {
    const oneShotTools = ['hand', 'lasso', 'text', 'sticky', 'rectangle'] as const

    for (const tool of oneShotTools) {
      useCanvasToolStore.getState().setActiveTool(tool)
      useCanvasToolStore.getState().completeActiveToolAction()
      expect(useCanvasToolStore.getState().activeTool).toBe('select')
    }
  })
})
