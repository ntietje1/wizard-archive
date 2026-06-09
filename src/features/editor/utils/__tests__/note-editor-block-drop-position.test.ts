import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import { getNearestNoteEditorBlockDropPlacement } from '../note-editor-block-drop-position'

function blockRect(top: number, bottom: number): DOMRect {
  return {
    bottom,
    height: bottom - top,
    left: 100,
    right: 500,
    top,
    width: 400,
    x: 100,
    y: top,
    toJSON: () => ({}),
  }
}

function createEditor() {
  const editorElement = document.createElement('div')
  const firstElement = document.createElement('div')
  firstElement.setAttribute('data-node-type', 'blockContainer')
  firstElement.setAttribute('data-id', 'first')
  firstElement.getBoundingClientRect = vi.fn(() => blockRect(100, 140))
  const secondElement = document.createElement('div')
  secondElement.setAttribute('data-node-type', 'blockContainer')
  secondElement.setAttribute('data-id', 'second')
  secondElement.getBoundingClientRect = vi.fn(() => blockRect(180, 220))
  editorElement.append(firstElement, secondElement)
  document.body.append(editorElement)

  const firstBlock = { id: 'first' }
  const secondBlock = { id: 'second' }
  const editor = {
    document: [firstBlock, secondBlock],
    getBlock: vi.fn((id: string) => {
      if (id === 'first') return firstBlock
      if (id === 'second') return secondBlock
      return undefined
    }),
    getTextCursorPosition: vi.fn(() => ({ block: secondBlock })),
    _tiptapEditor: {
      view: {
        dom: editorElement,
      },
    },
  } as unknown as CustomBlockNoteEditor

  return { editor, firstBlock, firstElement, secondBlock, secondElement }
}

describe('getNearestNoteEditorBlockDropPlacement', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('returns before the block when the pointer is nearer its top boundary', () => {
    const { editor, secondBlock, secondElement } = createEditor()

    expect(getNearestNoteEditorBlockDropPlacement(editor, { clientX: 300, clientY: 184 })).toEqual({
      blockElement: secondElement,
      placement: 'before',
      referenceBlock: secondBlock,
    })
  })

  it('returns after the nearest previous block when that boundary is closer', () => {
    const { editor, firstBlock, firstElement } = createEditor()

    expect(getNearestNoteEditorBlockDropPlacement(editor, { clientX: 300, clientY: 142 })).toEqual({
      blockElement: firstElement,
      placement: 'after',
      referenceBlock: firstBlock,
    })
  })

  it('falls back to the active cursor block when no block DOM can be resolved', () => {
    const { editor, secondBlock } = createEditor()
    editor._tiptapEditor.view.dom.replaceChildren()

    expect(getNearestNoteEditorBlockDropPlacement(editor, { clientX: 300, clientY: 184 })).toEqual({
      blockElement: null,
      placement: 'after',
      referenceBlock: secondBlock,
    })
  })
})
