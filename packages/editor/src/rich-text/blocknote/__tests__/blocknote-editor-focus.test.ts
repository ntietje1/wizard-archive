import { Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusEditorViewAtEnd, focusEditorViewAtNearestPoint } from '../blocknote-editor-focus'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('focusEditorViewAtNearestPoint', () => {
  it('sets selection at the resolved click position and focuses the mounted editor', () => {
    const selection = 'point-selection' as unknown as TextSelection
    const textSelectionNear = vi.spyOn(TextSelection, 'near').mockReturnValue(selection)
    const view = createMountedView({
      posAtCoords: vi.fn(() => ({ inside: 0, pos: 14 })),
    })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 10, y: 20 })).toBe(true)
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(view.state.doc.resolve).toHaveBeenCalledWith(14)
    expect(textSelectionNear).toHaveBeenCalledWith('resolved-14')
    expect(view.state.tr.setSelection).toHaveBeenCalledWith(selection)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledTimes(1)
  })

  it('retries with coordinates clamped to the editor bounds when the original point misses', () => {
    const selection = 'point-selection' as unknown as TextSelection
    vi.spyOn(TextSelection, 'near').mockReturnValue(selection)
    const posAtCoords = vi.fn().mockReturnValueOnce(null).mockReturnValueOnce({ inside: 0, pos: 4 })
    const view = createMountedView({
      rect: { left: 100, top: 50, right: 200, bottom: 150, width: 100, height: 100 },
      posAtCoords,
    })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 20, y: 180 })).toBe(true)
    expect(posAtCoords).toHaveBeenNthCalledWith(1, { left: 20, top: 180 })
    expect(posAtCoords).toHaveBeenNthCalledWith(2, { left: 101, top: 149 })
    expect(view.state.doc.resolve).toHaveBeenCalledWith(4)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
  })

  it('does not retry when clamping would use the same coordinates', () => {
    const posAtCoords = vi.fn(() => null)
    const view = createMountedView({ posAtCoords })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 10, y: 20 })).toBe(false)
    expect(posAtCoords).toHaveBeenCalledTimes(1)
    expect(posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.focus).not.toHaveBeenCalled()
  })

  it('does not retry when the editor bounds are invalid', () => {
    const posAtCoords = vi.fn(() => null)
    const view = createMountedView({
      posAtCoords,
      rect: { left: 10, top: 20, right: 10, bottom: 20, width: 0, height: 0 },
    })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 1, y: 2 })).toBe(false)
    expect(posAtCoords).toHaveBeenCalledExactlyOnceWith({ left: 1, top: 2 })
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.focus).not.toHaveBeenCalled()
  })

  it('fails gracefully when the editor bounds cannot be read', () => {
    const posAtCoords = vi.fn(() => null)
    const view = createMountedView({ posAtCoords })
    view.dom.getBoundingClientRect.mockImplementation(() => {
      throw new Error('detached')
    })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 1, y: 2 })).toBe(false)
    expect(posAtCoords).toHaveBeenCalledExactlyOnceWith({ left: 1, top: 2 })
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.focus).not.toHaveBeenCalled()
  })

  it('does not focus when dispatching the nearest-point selection fails', () => {
    vi.spyOn(TextSelection, 'near').mockReturnValue('selection' as unknown as TextSelection)
    const view = createMountedView({
      dispatch: vi.fn(() => {
        throw new Error('view destroyed')
      }),
    })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 10, y: 20 })).toBe(false)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).not.toHaveBeenCalled()
  })
})

describe('focusEditorViewAtEnd', () => {
  it('sets selection at the document end and focuses the editor', () => {
    const selection = 'selection' as unknown as Selection
    const selectionAtEnd = vi.spyOn(Selection, 'atEnd').mockReturnValue(selection)
    const view = createMountedView()

    expect(focusEditorViewAtEnd(asEditorView(view))).toBe(true)
    expect(selectionAtEnd).toHaveBeenCalledWith(view.state.doc)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith(selection)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).toHaveBeenCalledTimes(1)
  })

  it('keeps the document-end selection when the browser rejects focus', () => {
    const selection = 'selection' as unknown as Selection
    vi.spyOn(Selection, 'atEnd').mockReturnValue(selection)
    const view = createMountedView({
      focus: vi.fn(() => {
        throw new Error('focus failed')
      }),
    })

    expect(focusEditorViewAtEnd(asEditorView(view))).toBe(true)
    expect(view.state.tr.setSelection).toHaveBeenCalledWith(selection)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
  })

  it('does not focus when dispatching the document-end selection fails', () => {
    vi.spyOn(Selection, 'atEnd').mockReturnValue('selection' as unknown as Selection)
    const view = createMountedView({
      dispatch: vi.fn(() => {
        throw new Error('view destroyed')
      }),
    })

    expect(focusEditorViewAtEnd(asEditorView(view))).toBe(false)
    expect(view.dispatch).toHaveBeenCalledWith('transaction')
    expect(view.focus).not.toHaveBeenCalled()
  })
})

function createMountedView({
  dispatch = vi.fn(),
  focus = vi.fn(),
  posAtCoords = vi.fn(() => ({ inside: 0, pos: 14 })),
  rect = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
}: {
  dispatch?: ReturnType<typeof vi.fn>
  focus?: ReturnType<typeof vi.fn>
  posAtCoords?: ReturnType<typeof vi.fn>
  rect?: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>
} = {}) {
  return {
    dispatch,
    focus,
    posAtCoords,
    state: {
      doc: {
        content: { size: 42 },
        resolve: vi.fn((pos: number) => `resolved-${pos}`),
      },
      tr: {
        setSelection: vi.fn(() => 'transaction'),
      },
    },
    dom: {
      getBoundingClientRect: vi.fn(() => rect),
    },
  }
}

function asEditorView(view: ReturnType<typeof createMountedView>) {
  return view as unknown as EditorView
}
