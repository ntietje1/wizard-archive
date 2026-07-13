import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PreventExternalDrop } from '../prevent-external-drop'
import { removeProseMirrorDropCursors } from '../prevent-external-drop-cursors'
import { shouldPreventExternalFileDrop } from '../prevent-external-drop-policy'

const { editorDomElement } = vi.hoisted(() => ({
  editorDomElement: document.createElement('div'),
}))

vi.mock('@blocknote/react', () => ({
  useBlockNoteEditor: () => ({}),
}))

vi.mock('../use-editor-dom-element', () => ({
  useEditorDomElement: () => editorDomElement,
}))

vi.mock('../prevent-external-drop-cursors', () => ({
  removeProseMirrorDropCursors: vi.fn(),
}))

vi.mock('../prevent-external-drop-policy', () => ({
  shouldPreventExternalFileDrop: vi.fn(),
}))

describe('PreventExternalDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('wires capture-phase drop prevention to the editor DOM element', () => {
    const addEventListener = vi.spyOn(editorDomElement, 'addEventListener')
    const removeEventListener = vi.spyOn(editorDomElement, 'removeEventListener')
    vi.mocked(shouldPreventExternalFileDrop).mockReturnValue(true)

    const { unmount } = render(<PreventExternalDrop />)
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    const preventDefault = vi.spyOn(event, 'preventDefault')
    const stopImmediatePropagation = vi.spyOn(event, 'stopImmediatePropagation')

    editorDomElement.dispatchEvent(event)

    expect(addEventListener).toHaveBeenCalledWith('drop', expect.any(Function), true)
    expect(shouldPreventExternalFileDrop).toHaveBeenCalledExactlyOnceWith(event)
    expect(removeProseMirrorDropCursors).toHaveBeenCalledExactlyOnceWith(editorDomElement)
    expect(preventDefault).toHaveBeenCalledExactlyOnceWith()
    expect(stopImmediatePropagation).toHaveBeenCalledExactlyOnceWith()

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('drop', expect.any(Function), true)
  })

  it('prevents later drop listeners on the same editor element', () => {
    const laterListener = vi.fn()
    vi.mocked(shouldPreventExternalFileDrop).mockReturnValue(true)
    render(<PreventExternalDrop />)
    editorDomElement.addEventListener('drop', laterListener)

    editorDomElement.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }))

    expect(laterListener).not.toHaveBeenCalled()
    editorDomElement.removeEventListener('drop', laterListener)
  })

  it('leaves allowed drops untouched', () => {
    vi.mocked(shouldPreventExternalFileDrop).mockReturnValue(false)

    render(<PreventExternalDrop />)
    const event = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    const preventDefault = vi.spyOn(event, 'preventDefault')
    const stopImmediatePropagation = vi.spyOn(event, 'stopImmediatePropagation')

    editorDomElement.dispatchEvent(event)

    expect(removeProseMirrorDropCursors).not.toHaveBeenCalled()
    expect(preventDefault).not.toHaveBeenCalled()
    expect(stopImmediatePropagation).not.toHaveBeenCalled()
  })
})
