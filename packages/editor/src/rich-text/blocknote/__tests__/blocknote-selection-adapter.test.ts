import { Selection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  blockNoteSelectionSnapshotCollapsedPosition,
  captureBlockNoteSelection,
  restoreBlockNoteSelection,
  setBlockNotePendingTextColor,
} from '../blocknote-selection-adapter'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('captureBlockNoteSelection', () => {
  it('returns null when there is no editor', () => {
    expect(captureBlockNoteSelection(null)).toBeNull()
  })

  it('reads the selection from the public ProseMirror view accessor', () => {
    const selection = { anchor: 1, head: 1 }
    const editor = {
      focus: vi.fn(),
      prosemirrorView: createEditorView(selection),
    } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    expect(captureBlockNoteSelection(editor)).toEqual(selection)
  })

  it('treats torn-down ProseMirror selection state as unavailable', () => {
    const editor = {
      focus: vi.fn(),
      prosemirrorView: {
        ...createEditorView({ anchor: 1, head: 1 }),
        state: {
          get selection() {
            throw new Error('view destroyed')
          },
        },
      },
    } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    expect(captureBlockNoteSelection(editor)).toBeNull()
  })
})

describe('restoreBlockNoteSelection', () => {
  it('restores the saved selection and focuses the mounted editor view', () => {
    const selection = { anchor: 1, head: 1 }
    const restoredSelection = { type: 'text', anchor: 1, head: 1 } as unknown as Selection
    const view = createEditorView(selection)
    const fromJSON = vi.spyOn(Selection, 'fromJSON').mockReturnValue(restoredSelection)
    const editor = {
      focus: vi.fn(),
      prosemirrorView: view,
    } as unknown as Parameters<typeof restoreBlockNoteSelection>[0]

    restoreBlockNoteSelection(editor, selection)

    expect(fromJSON).toHaveBeenCalledWith(view.state.doc, selection)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith(restoredSelection)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledExactlyOnceWith()
    expect(editor.focus).not.toHaveBeenCalled()
  })

  it('keeps focus when the saved selection is stale', () => {
    vi.spyOn(Selection, 'fromJSON').mockImplementation(() => {
      throw new Error('stale selection')
    })
    const view = createEditorView({ anchor: 1, head: 1 })
    const editor = {
      focus: vi.fn(),
      prosemirrorView: view,
    } as unknown as Parameters<typeof restoreBlockNoteSelection>[0]

    restoreBlockNoteSelection(editor, { anchor: 99, head: 99 })

    expect(view.state.tr.setSelection).not.toHaveBeenCalled()
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.focus).toHaveBeenCalledExactlyOnceWith()
    expect(editor.focus).not.toHaveBeenCalled()
  })

  it('focuses the mounted editor view when there is no saved selection', () => {
    const view = createEditorView({ anchor: 1, head: 1 })
    const fromJSON = vi.spyOn(Selection, 'fromJSON')
    const editor = {
      focus: vi.fn(),
      prosemirrorView: view,
    } as unknown as Parameters<typeof restoreBlockNoteSelection>[0]

    restoreBlockNoteSelection(editor, null)

    expect(fromJSON).not.toHaveBeenCalled()
    expect(view.state.tr.setSelection).not.toHaveBeenCalled()
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.focus).toHaveBeenCalledExactlyOnceWith()
  })

  it('falls back to editor focus when the ProseMirror view is unavailable', () => {
    const editor = {
      focus: vi.fn(),
      prosemirrorView: null,
    } as unknown as Parameters<typeof restoreBlockNoteSelection>[0]

    restoreBlockNoteSelection(editor, { anchor: 1, head: 1 })

    expect(editor.focus).toHaveBeenCalledExactlyOnceWith()
  })
})

describe('setBlockNotePendingTextColor', () => {
  it('ignores pending text color updates when there is no editor', () => {
    expect(() => setBlockNotePendingTextColor(null, 'rgb(1, 2, 3)')).not.toThrow()
    expect(() => setBlockNotePendingTextColor(null, null)).not.toThrow()
  })

  it('sets pending text color on the mounted BlockNote editor element', () => {
    const dom = document.createElement('div')
    const editor = {
      focus: vi.fn(),
      prosemirrorView: { ...createEditorView({ anchor: 1, head: 1 }), dom },
    } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    setBlockNotePendingTextColor(editor, 'rgb(1, 2, 3)')

    expect(dom.style.getPropertyValue('--formatting-pending-text-color')).toBe('rgb(1, 2, 3)')
  })

  it('clears pending text color from the mounted BlockNote editor element', () => {
    const dom = document.createElement('div')
    dom.style.setProperty('--formatting-pending-text-color', 'rgb(1, 2, 3)')
    const editor = {
      focus: vi.fn(),
      prosemirrorView: { ...createEditorView({ anchor: 1, head: 1 }), dom },
    } as unknown as Parameters<typeof captureBlockNoteSelection>[0]

    setBlockNotePendingTextColor(editor, null)

    expect(dom.style.getPropertyValue('--formatting-pending-text-color')).toBe('')
  })
})

describe('blockNoteSelectionSnapshotCollapsedPosition', () => {
  it('returns the shared anchor/head position for collapsed selections', () => {
    expect(blockNoteSelectionSnapshotCollapsedPosition({ anchor: 4, head: 4 })).toBe(4)
  })

  it('treats ranged, missing, and non-numeric snapshots as not collapsed', () => {
    expect(blockNoteSelectionSnapshotCollapsedPosition({ anchor: 4, head: 8 })).toBeNull()
    expect(blockNoteSelectionSnapshotCollapsedPosition({ anchor: 4 })).toBeNull()
    expect(blockNoteSelectionSnapshotCollapsedPosition({ anchor: '4', head: '4' })).toBeNull()
    expect(blockNoteSelectionSnapshotCollapsedPosition(null)).toBeNull()
  })
})

function createEditorView(selection: Record<string, unknown>) {
  return {
    dispatch: vi.fn(),
    focus: vi.fn(),
    state: {
      doc: {} as never,
      selection: {
        toJSON: vi.fn(() => selection),
      },
      tr: {
        setSelection: vi.fn(() => 'transaction'),
      },
    },
  }
}
