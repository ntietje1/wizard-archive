import { describe, expect, it, vi } from 'vitest'
import {
  captureBlockNoteSelection,
  setBlockNotePendingTextColor,
} from '../blocknote-selection-adapter'

describe('captureBlockNoteSelection', () => {
  it('reads the selection from the public ProseMirror view accessor', () => {
    const selection = { anchor: 1, head: 1 }
    const editor = {
      focus: vi.fn(),
      prosemirrorView: createEditorView(selection),
    } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    expect(captureBlockNoteSelection(editor)).toEqual(selection)
  })

  it('returns null when the editor does not expose a ProseMirror view', () => {
    const editor = { focus: vi.fn() } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    expect(captureBlockNoteSelection(editor)).toBeNull()
  })

  it('treats an unmounted ProseMirror view accessor as unavailable', () => {
    const editor = {
      focus: vi.fn(),
      get prosemirrorView() {
        throw new Error(
          "[tiptap error]: The editor view is not available. Cannot access view['dom']. The editor may not be mounted yet.",
        )
      },
    } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    expect(captureBlockNoteSelection(editor)).toBeNull()
    expect(() => setBlockNotePendingTextColor(editor, null)).not.toThrow()
  })
})

function createEditorView(selection: Record<string, unknown>) {
  return {
    dispatch: vi.fn(),
    focus: vi.fn(),
    state: {
      doc: {},
      selection: {
        toJSON: vi.fn(() => selection),
      },
      tr: {
        setSelection: vi.fn(),
      },
    },
  }
}
