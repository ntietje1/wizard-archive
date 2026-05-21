import { act, renderHook } from '@testing-library/react'
import { BlockNoteEditor } from '@blocknote/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteEditorState } from '../useNoteEditorState'
import { editorSchema } from '~/features/editor/editor-specs'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
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
    const mockEditor = BlockNoteEditor.create({ schema: editorSchema }) as CustomBlockNoteEditor
    const collaborativeDoc = null
    const collaborativeProvider = null

    act(() => {
      result.current.onEditorChange(mockEditor, collaborativeDoc, collaborativeProvider)
    })

    expect(claimEditorSpy).toHaveBeenCalledTimes(1)

    unmount()

    expect(releaseEditor).toHaveBeenCalledTimes(1)

    mockEditor._tiptapEditor.destroy()
  })
})
