import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCanvasToolPropertyContext } from '../canvas-tool-state-controls'
import { useCanvasToolStore } from '../canvas-tool-store'

describe('useCanvasToolPropertyContext', () => {
  beforeEach(() => {
    useCanvasToolStore.getState().reset()
  })

  it('refreshes draw tool settings when tool state changes without needing a canvas mutation', () => {
    const { result } = renderHook(() => useCanvasToolPropertyContext())

    act(() => {
      useCanvasToolStore.getState().setActiveTool('draw')
      useCanvasToolStore.getState().setStrokeColor('var(--t-red)')
      useCanvasToolStore.getState().setStrokeOpacity(42)
      useCanvasToolStore.getState().setStrokeSize(8)
    })

    expect(result.current.toolState.getSettings()).toEqual({
      strokeColor: 'var(--t-red)',
      strokeOpacity: 42,
      strokeSize: 8,
    })
  })
})
