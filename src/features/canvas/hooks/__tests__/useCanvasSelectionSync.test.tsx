import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCanvasSelectionSync } from '../useCanvasSelectionSync'
import type { Node } from '@xyflow/react'

const selectionMock = vi.hoisted(() => ({
  onChange: null as ((payload: { nodes: Array<Node> }) => void) | null,
  setNodes: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  useOnSelectionChange: ({ onChange }: { onChange: (payload: { nodes: Array<Node> }) => void }) => {
    selectionMock.onChange = onChange
  },
  useReactFlow: () => ({
    setNodes: selectionMock.setNodes,
  }),
}))

describe('useCanvasSelectionSync', () => {
  beforeEach(() => {
    selectionMock.onChange = null
    selectionMock.setNodes.mockReset()
  })

  it('clears embed editing when the embed is no longer the exclusive selection', () => {
    const setLocalSelection = vi.fn()
    const onHistorySelectionChange = vi.fn()
    const setEditingEmbedId = vi.fn()

    renderHook(() =>
      useCanvasSelectionSync({
        setLocalSelection,
        onHistorySelectionChange,
        editingEmbedId: 'embed-1',
        setEditingEmbedId,
      }),
    )

    act(() => {
      selectionMock.onChange?.({
        nodes: [{ id: 'embed-1' }, { id: 'text-1' }] as Array<Node>,
      })
    })

    expect(setEditingEmbedId).toHaveBeenCalledWith(null)
  })

  it('keeps embed editing active when the embed remains exclusively selected', () => {
    const setEditingEmbedId = vi.fn()

    renderHook(() =>
      useCanvasSelectionSync({
        setLocalSelection: vi.fn(),
        onHistorySelectionChange: vi.fn(),
        editingEmbedId: 'embed-1',
        setEditingEmbedId,
      }),
    )

    act(() => {
      selectionMock.onChange?.({
        nodes: [{ id: 'embed-1' }] as Array<Node>,
      })
    })

    expect(setEditingEmbedId).not.toHaveBeenCalled()
  })
})
