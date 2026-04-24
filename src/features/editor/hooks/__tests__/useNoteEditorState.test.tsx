import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteEditorState } from '../useNoteEditorState'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { testId } from '~/test/helpers/test-id'

const previewSpy = vi.hoisted(() => vi.fn())
const dropTargetSpy = vi.hoisted(() => vi.fn())
const claimEditorSpy = vi.hoisted(() => vi.fn(() => vi.fn()))

vi.mock('~/features/previews/hooks/use-yjs-preview-upload', () => ({
  useYjsPreviewUpload: previewSpy,
}))

vi.mock('~/features/dnd/hooks/useNoteEditorDropTarget', () => ({
  useNoteEditorDropTarget: dropTargetSpy,
}))

vi.mock('~/features/editor/stores/note-editor-store', () => ({
  useNoteEditorStore: (selector: (store: { claimEditor: typeof claimEditorSpy }) => unknown) =>
    selector({ claimEditor: claimEditorSpy }),
}))

describe('useNoteEditorState', () => {
  beforeEach(() => {
    previewSpy.mockReset()
    dropTargetSpy.mockReset()
    claimEditorSpy.mockClear()
  })

  it('uses the shared Yjs preview hook with the BlockNote editor resolver', () => {
    renderHook(() => useNoteEditorState(testId<'sidebarItems'>('note-id')))

    expect(previewSpy).toHaveBeenCalledWith({
      itemId: 'note-id',
      doc: null,
      containerRef: expect.any(Object),
      resolveElement: expect.any(Function),
    })
    expect(dropTargetSpy).toHaveBeenCalledWith({
      ref: expect.any(Object),
      noteId: 'note-id',
    })

    const args = previewSpy.mock.calls[0]?.[0] as {
      resolveElement: (container: HTMLElement) => HTMLElement | null
    }
    const container = document.createElement('div')
    const target = document.createElement('div')
    target.className = 'bn-editor'
    container.appendChild(target)

    expect(args.resolveElement(container)).toBe(target)
    expect(args.resolveElement(document.createElement('div'))).toBeNull()
  })

  it('claims the editor when the editor instance changes and releases it on unmount', () => {
    const releaseEditor = vi.fn()
    claimEditorSpy.mockReturnValue(releaseEditor)

    const { result, unmount } = renderHook(() =>
      useNoteEditorState(testId<'sidebarItems'>('note-id')),
    )

    act(() => {
      result.current.onEditorChange({} as unknown as CustomBlockNoteEditor, null)
    })

    expect(claimEditorSpy).toHaveBeenCalledTimes(1)

    unmount()

    expect(releaseEditor).toHaveBeenCalledTimes(1)
  })
})
