import { Selection, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusEditorViewAtEnd, focusEditorViewAtNearestPoint } from '../note-editor-focus'

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
    expect(view.dom.getBoundingClientRect).not.toHaveBeenCalled()
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

  it('returns false when no point position resolves', () => {
    const view = createMountedView({ posAtCoords: vi.fn(() => null) })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 10, y: 20 })).toBe(false)
    expect(view.dispatch).not.toHaveBeenCalled()
    expect(view.focus).not.toHaveBeenCalled()
  })

  it('returns false when selection dispatch throws', () => {
    const view = createMountedView()
    view.dispatch.mockImplementationOnce(() => {
      throw new Error('dispatch failed')
    })

    expect(focusEditorViewAtNearestPoint(asEditorView(view), { x: 10, y: 20 })).toBe(false)
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

  it('returns false when document-end dispatch throws', () => {
    const view = createMountedView()
    view.dispatch.mockImplementationOnce(() => {
      throw new Error('dispatch failed')
    })

    expect(focusEditorViewAtEnd(asEditorView(view))).toBe(false)
    expect(view.focus).not.toHaveBeenCalled()
  })
})

function createMountedView({
  posAtCoords = vi.fn(() => ({ inside: 0, pos: 14 })),
  rect = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
}: {
  posAtCoords?: ReturnType<typeof vi.fn>
  rect?: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>
} = {}) {
  return {
    dispatch: vi.fn(),
    focus: vi.fn(),
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
