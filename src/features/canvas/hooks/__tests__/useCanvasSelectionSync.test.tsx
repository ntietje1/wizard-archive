import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionSync } from '../useCanvasSelectionSync'
import { useCanvasSelectionState } from '../useCanvasSelectionState'

describe('useCanvasSelectionSync', () => {
  beforeEach(() => {
    useCanvasSelectionState.getState().reset()
  })

  it('syncs local selection and history when the selection changes', () => {
    const setLocalSelection = vi.fn()
    const onHistorySelectionChange = vi.fn()

    renderHook(() =>
      useCanvasSelectionSync({
        setLocalSelection,
        onHistorySelectionChange,
      }),
    )

    act(() => {
      useCanvasSelectionState.getState().setSelectedNodeIds(['embed-1', 'text-1'])
    })

    expect(setLocalSelection).toHaveBeenCalledWith(['embed-1', 'text-1'])
    expect(onHistorySelectionChange).toHaveBeenCalledWith(['embed-1', 'text-1'])
  })

  it('clears local selection and history when the authoritative selection is cleared', () => {
    const setLocalSelection = vi.fn()
    const onHistorySelectionChange = vi.fn()

    renderHook(() =>
      useCanvasSelectionSync({
        setLocalSelection,
        onHistorySelectionChange,
      }),
    )

    act(() => {
      useCanvasSelectionState.getState().setSelectedNodeIds(['embed-1'])
    })

    act(() => {
      useCanvasSelectionState.getState().setSelectedNodeIds([])
    })

    expect(setLocalSelection).toHaveBeenLastCalledWith(null)
    expect(onHistorySelectionChange).toHaveBeenLastCalledWith([])
  })
})
