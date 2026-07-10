import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOwnedBlockNoteEditor } from '../use-owned-blocknote-editor'

describe('useOwnedBlockNoteEditor', () => {
  it('keeps the editor instance stable across unrelated rerenders and cleans it up on unmount', () => {
    const createdEditor = { id: 'editor-1' }
    const createEditor = vi.fn(() => createdEditor)
    const destroyEditor = vi.fn()
    const onEditorChange = vi.fn()

    const { result, rerender, unmount } = renderHook(
      ({ contentKey }: { contentKey: string }) => {
        return {
          contentKey,
          editor: useOwnedBlockNoteEditor({
            createEditor: () => createEditor(),
            destroyEditor: (editor) => destroyEditor(editor),
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
    expect(destroyEditor).toHaveBeenCalledTimes(1)
    expect(onEditorChange).toHaveBeenLastCalledWith(null)
    expect(onEditorChange).toHaveBeenCalledTimes(2)
  })

  it('replaces the owned editor when identity changes', () => {
    const firstEditor = { id: 'editor-1' }
    const secondEditor = { id: 'editor-2' }
    const createEditor = vi.fn(() => firstEditor)
    const destroyEditor = vi.fn()
    const onEditorChange = vi.fn()

    const { result, rerender } = renderHook(
      ({ identity }: { identity: string }) =>
        useOwnedBlockNoteEditor({
          createEditor,
          destroyEditor,
          identity,
          onEditorChange,
        }),
      { initialProps: { identity: 'one' } },
    )

    createEditor.mockReturnValue(secondEditor)
    rerender({ identity: 'two' })

    expect(result.current).toBe(secondEditor)
    expect(destroyEditor).toHaveBeenCalledExactlyOnceWith(firstEditor)
    expect(onEditorChange).toHaveBeenNthCalledWith(1, firstEditor)
    expect(onEditorChange).toHaveBeenNthCalledWith(2, null)
    expect(onEditorChange).toHaveBeenNthCalledWith(3, secondEditor)
  })

  it('clears the owned editor when replacement construction returns null', () => {
    const firstEditor = { id: 'editor-1' }
    const createEditor = vi.fn<() => typeof firstEditor | null>()
    createEditor.mockReturnValueOnce(firstEditor).mockReturnValueOnce(null)
    const destroyEditor = vi.fn()
    const onEditorChange = vi.fn()

    const { result, rerender } = renderHook(
      ({ identity }: { identity: string }) =>
        useOwnedBlockNoteEditor({
          createEditor,
          destroyEditor,
          identity,
          onEditorChange,
        }),
      { initialProps: { identity: 'one' } },
    )

    rerender({ identity: 'two' })

    expect(result.current).toBeNull()
    expect(destroyEditor).toHaveBeenCalledExactlyOnceWith(firstEditor)
    expect(onEditorChange).toHaveBeenNthCalledWith(1, firstEditor)
    expect(onEditorChange).toHaveBeenNthCalledWith(2, null)
  })

  it('keeps cleanup local when editor destruction throws', () => {
    const createdEditor = { id: 'editor-1' }
    const destroyError = new Error('destroy failed')
    const onEditorChange = vi.fn()

    const { unmount } = renderHook(() =>
      useOwnedBlockNoteEditor({
        createEditor: () => createdEditor,
        destroyEditor: () => {
          throw destroyError
        },
        onEditorChange,
      }),
    )

    expect(() => unmount()).not.toThrow()
    expect(onEditorChange).toHaveBeenNthCalledWith(1, createdEditor)
    expect(onEditorChange).toHaveBeenNthCalledWith(2, null)
  })
})
