import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useInlineCanvasNodeEdit } from '../use-inline-canvas-node-edit'

vi.mock('../use-pending-node-edit', () => ({
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

  it('commits edits when the commit predicate matches', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() =>
      useInlineCanvasNodeEdit<HTMLInputElement>({
        id: 'text-1',
        selected: true,
        value: 'Original',
        onCommit,
        shouldCommit: (event) => event.key === 'Enter',
        shouldCancel: () => false,
      }),
    )

    act(() => {
      result.current.startEditing()
      result.current.setEditValue('Updated')
    })

    act(() => {
      result.current.handleInputKeyDown({
        key: 'Enter',
        currentTarget: { value: 'Updated' },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>)
    })

    expect(onCommit).toHaveBeenCalledWith('Updated')
    expect(result.current.isEditing).toBe(false)
  })

  it('cancels edits when the cancel predicate matches', () => {
    const { result } = renderHook(() =>
      useInlineCanvasNodeEdit<HTMLInputElement>({
        id: 'text-1',
        selected: true,
        value: 'Original',
        onCommit: vi.fn(),
        shouldCommit: () => false,
        shouldCancel: (event) => event.key === 'Escape',
      }),
    )

    act(() => {
      result.current.startEditing()
      result.current.setEditValue('Draft')
    })

    act(() => {
      result.current.handleInputKeyDown({
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>)
    })

    expect(result.current.isEditing).toBe(false)
    expect(result.current.editValue).toBe('Original')
  })

  it('exits edit mode when selection is lost', () => {
    const { result, rerender } = renderHook(
      ({ selected }) =>
        useInlineCanvasNodeEdit<HTMLInputElement>({
          id: 'text-1',
          selected,
          value: 'Original',
          onCommit: vi.fn(),
          shouldCommit: () => false,
          shouldCancel: () => false,
        }),
      {
        initialProps: { selected: true },
      },
    )

    act(() => {
      result.current.startEditing()
      result.current.setEditValue('Draft')
    })

    rerender({ selected: false })

    expect(result.current.isEditing).toBe(false)
    expect(result.current.editValue).toBe('Original')
  })
})
