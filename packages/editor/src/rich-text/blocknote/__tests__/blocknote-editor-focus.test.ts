import { Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { focusEditorViewAtEnd, focusEditorViewAtNearestPoint } from '../blocknote-editor-focus'

afterEach(() => vi.restoreAllMocks())

describe('BlockNote editor focus', () => {
  it('places the caret at the native position nearest the activation point', () => {
    const selection = 'point-selection' as unknown as TextSelection
    vi.spyOn(TextSelection, 'near').mockReturnValue(selection)
    const view = createView()

    expect(focusEditorViewAtNearestPoint(view, { x: 10, y: 20 })).toBe(true)
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(view.state.doc.resolve).toHaveBeenCalledWith(14)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith(selection)
    expect(view.focus).toHaveBeenCalledOnce()
  })

  it('clamps missed activation points to the editor surface', () => {
    vi.spyOn(TextSelection, 'near').mockReturnValue('selection' as unknown as TextSelection)
    const posAtCoords = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce({ pos: 4 })
    const view = createView(posAtCoords)

    expect(focusEditorViewAtNearestPoint(view, { x: 20, y: 180 })).toBe(true)
    expect(posAtCoords).toHaveBeenNthCalledWith(2, { left: 101, top: 149 })
  })

  it('falls back to a checked document-end selection', () => {
    const selection = 'end-selection' as unknown as Selection
    vi.spyOn(Selection, 'atEnd').mockReturnValue(selection)
    const view = createView()

    expect(focusEditorViewAtEnd(view)).toBe(true)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith(selection)
    expect(view.focus).toHaveBeenCalledOnce()
  })
})

function createView(posAtCoords = vi.fn(() => ({ pos: 14 }))) {
  return {
    dispatch: vi.fn(),
    focus: vi.fn(),
    posAtCoords,
    state: {
      doc: { resolve: vi.fn((position: number) => `resolved-${position}`) },
      tr: { setSelection: vi.fn(() => 'transaction') },
    },
    dom: {
      getBoundingClientRect: vi.fn(() => ({
        left: 100,
        top: 50,
        right: 200,
        bottom: 150,
        width: 100,
        height: 100,
      })),
    },
  } as unknown as EditorView & {
    focus: ReturnType<typeof vi.fn>
    posAtCoords: ReturnType<typeof vi.fn>
    state: {
      doc: { resolve: ReturnType<typeof vi.fn> }
      tr: { setSelection: ReturnType<typeof vi.fn> }
    }
  }
}
