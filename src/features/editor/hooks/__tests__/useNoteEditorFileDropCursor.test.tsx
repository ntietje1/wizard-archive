import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { useNoteEditorFileDropCursor } from '../useNoteEditorFileDropCursor'

const dropCursor = vi.hoisted(() => vi.fn(() => ({ spec: { view: vi.fn() } })))

vi.mock('@tiptap/pm/dropcursor', () => ({
  dropCursor,
}))

function createEditor() {
  const view = {
    dom: document.createElement('div'),
  }
  const tiptapEditor = {
    view,
    registerPlugin: vi.fn(),
  }

  return {
    editor: { _tiptapEditor: tiptapEditor } as unknown as CustomBlockNoteEditor,
    tiptapEditor,
  }
}

async function flushAnimationFrame() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('useNoteEditorFileDropCursor', () => {
  afterEach(() => {
    dropCursor.mockClear()
  })

  it('registers the native ProseMirror dropcursor plugin for editable note editors', async () => {
    const { editor, tiptapEditor } = createEditor()

    renderHook(() => useNoteEditorFileDropCursor(editor, true))
    await flushAnimationFrame()

    expect(dropCursor).toHaveBeenCalledWith({
      color: false,
      width: 2,
      class: 'note-editor-file-drop-cursor',
    })
    expect(tiptapEditor.registerPlugin).toHaveBeenCalledWith(dropCursor.mock.results[0].value)
  })

  it('does not register a dropcursor for non-editable note editors', async () => {
    const { editor, tiptapEditor } = createEditor()

    renderHook(() => useNoteEditorFileDropCursor(editor, false))
    await flushAnimationFrame()

    expect(dropCursor).not.toHaveBeenCalled()
    expect(tiptapEditor.registerPlugin).not.toHaveBeenCalled()
  })

  it('does not register duplicate dropcursor plugins for the same editor', async () => {
    const { editor, tiptapEditor } = createEditor()
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useNoteEditorFileDropCursor(editor, enabled),
      { initialProps: { enabled: true } },
    )
    await flushAnimationFrame()

    rerender({ enabled: false })
    rerender({ enabled: true })
    await flushAnimationFrame()

    expect(dropCursor).toHaveBeenCalledTimes(1)
    expect(tiptapEditor.registerPlugin).toHaveBeenCalledTimes(1)
  })
})
