import { describe, expect, it, vi } from 'vitest'
import { captureBlockNoteSelection } from '../blocknote-selection-adapter'

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
