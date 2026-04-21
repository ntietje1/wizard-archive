import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCallback } from 'react'
import { useOwnedBlockNoteEditor } from '../useOwnedBlockNoteEditor'

describe('useOwnedBlockNoteEditor', () => {
  it('keeps the editor instance stable across unrelated rerenders and cleans it up on unmount', () => {
    const createdEditor = { id: 'editor-1' }
    const createEditor = vi.fn(() => createdEditor)
    const destroyEditor = vi.fn()
    const onEditorChange = vi.fn()

    const { result, rerender, unmount } = renderHook(
      ({ contentKey }: { contentKey: string }) => {
        const create = useCallback(() => createEditor(), [])
        const destroy = useCallback((editor: typeof createdEditor) => destroyEditor(editor), [])

        return {
          contentKey,
          editor: useOwnedBlockNoteEditor({
            createEditor: create,
            destroyEditor: destroy,
            onEditorChange,
          }),
        }
      },
      { initialProps: { contentKey: 'one' } },
    )

    expect(result.current.editor).toBe(createdEditor)
    expect(createEditor).toHaveBeenCalledTimes(1)
    expect(onEditorChange).toHaveBeenNthCalledWith(1, createdEditor)

    rerender({ contentKey: 'two' })

    expect(result.current.editor).toBe(createdEditor)
    expect(createEditor).toHaveBeenCalledTimes(1)

    unmount()

    expect(destroyEditor).toHaveBeenCalledWith(createdEditor)
    expect(onEditorChange).toHaveBeenLastCalledWith(null)
  })
})
