import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { createCanvasToolStore } from '../../stores/canvas-tool-store'
import { useCanvasEffectiveTool } from '../use-canvas-effective-tool'

describe('useCanvasEffectiveTool', () => {
  const toolStore = createCanvasToolStore()

  beforeEach(() => {
    toolStore.getState().reset()
  })

  it('normalizes stale edit tools to select as soon as the canvas becomes read-only', () => {
    toolStore.getState().setActiveTool('draw')
    const { result, rerender } = renderHook(
      ({ canEdit }) => useCanvasEffectiveTool(toolStore, canEdit),
      { initialProps: { canEdit: true } },
    )

    expect(result.current).toBe('draw')

    rerender({ canEdit: false })

    expect(result.current).toBe('select')
    expect(toolStore.getState().activeTool).toBe('select')
  })

  it('rejects edit-tool transitions while the canvas remains read-only', () => {
    const { result } = renderHook(() => useCanvasEffectiveTool(toolStore, false))

    act(() => toolStore.getState().setActiveTool('edge'))

    expect(result.current).toBe('select')
    expect(toolStore.getState().activeTool).toBe('select')
  })
})
