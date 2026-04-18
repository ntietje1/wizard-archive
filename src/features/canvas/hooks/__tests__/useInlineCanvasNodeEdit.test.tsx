import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useInlineCanvasNodeEdit } from '../useInlineCanvasNodeEdit'

vi.mock('../usePendingNodeEdit', () => ({
  usePendingNodeEdit: vi.fn(),
}))

describe('useInlineCanvasNodeEdit', () => {
  it('does not reset an in-progress edit when startEditing is called again', () => {
    const { result } = renderHook(() =>
      useInlineCanvasNodeEdit<HTMLInputElement>({
        id: 'text-1',
        selected: true,
        value: 'Original',
        onCommit: vi.fn(),
        shouldCommit: () => false,
        shouldCancel: () => false,
      }),
    )

    act(() => {
      result.current.startEditing()
      result.current.setEditValue('Draft')
    })

    act(() => {
      result.current.startEditing()
    })

    expect(result.current.isEditing).toBe(true)
    expect(result.current.editValue).toBe('Draft')
  })

  it('exposes cancelEdit so callers can reset edits programmatically', () => {
    const { result } = renderHook(() =>
      useInlineCanvasNodeEdit<HTMLInputElement>({
        id: 'text-1',
        selected: true,
        value: 'Original',
        onCommit: vi.fn(),
        shouldCommit: () => false,
        shouldCancel: () => false,
      }),
    )

    act(() => {
      result.current.startEditing()
      result.current.setEditValue('Draft')
      result.current.cancelEdit()
    })

    expect(result.current.isEditing).toBe(false)
    expect(result.current.editValue).toBe('Original')
  })
})
