import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { createCanvasToolStore, useCanvasToolPropertyContext } from '../canvas-tool-store'

const canvasToolStore = createCanvasToolStore()

describe('useCanvasToolPropertyContext', () => {
  beforeEach(() => {
    canvasToolStore.getState().reset()
  })

  it('refreshes draw tool settings when tool state changes without needing a canvas mutation', () => {
    const { result } = renderHook(() => useCanvasToolPropertyContext(canvasToolStore))

    act(() => {
      canvasToolStore.getState().setActiveTool('draw')
      canvasToolStore.getState().setEdgeType('straight')
      canvasToolStore.getState().setStrokeColor('var(--t-red)')
      canvasToolStore.getState().setStrokeOpacity(42)
      canvasToolStore.getState().setStrokeSize(8)
    })

    expect(result.current.toolState.getSettings()).toEqual({
      edgeType: 'straight',
      strokeColor: 'var(--t-red)',
      strokeOpacity: 42,
      strokeSize: 8,
    })
  })
})
