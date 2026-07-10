import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { getBlockNoteContextFromTarget } from '../target-context'
import type { CustomBlockNoteEditor } from '../../editor-schema'

const getNearestBlockPosMock = vi.hoisted(() => vi.fn())

vi.mock('@blocknote/core', () => ({
  getNearestBlockPos: getNearestBlockPosMock,
}))

afterEach(() => {
  document.body.replaceChildren()
})

describe('getBlockNoteContextFromTarget', () => {
  it('uses the ProseMirror block id when rendered block data attributes are stale', () => {
    const { textTarget } = createBlockDom({
      domBlockId: 'initialBlockId',
      text: 'Visible block text',
    })
    const view = {
      posAtCoords: vi.fn(() => ({ pos: 42 })),
      posAtDOM: vi.fn(() => 17),
      state: { doc: {} },
    }
    const editor = {
      getBlock: vi.fn((blockId: string) =>
        blockId === 'visiblenoteBlockId' ? { id: blockId } : undefined,
      ),
      prosemirrorView: view,
    } as unknown as CustomBlockNoteEditor
    getNearestBlockPosMock.mockReturnValue({
      node: { attrs: { id: 'visiblenoteBlockId' } },
    })

    expect(
      getBlockNoteContextFromTarget({
        editable: true,
        editor,
        position: { x: 10, y: 20 },
        target: textTarget,
      }),
    ).toMatchObject({
      noteBlockId: 'visiblenoteBlockId',
      valueInlineEditable: false,
      valueInlineId: undefined,
      valueInlineInstanceId: undefined,
    })
    expect(view.posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
  })

  it('keeps the DOM fallback for non-editor test doubles', () => {
    const { textTarget } = createBlockDom({
      domBlockId: 'domBlockId',
      text: 'Static block text',
    })

    expect(
      getBlockNoteContextFromTarget({
        editable: false,
        editor: null,
        position: { x: 10, y: 20 },
        target: textTarget,
      }).noteBlockId,
    ).toBe('domBlockId')
  })
})

function createBlockDom({ domBlockId, text }: { domBlockId: string; text: string }) {
  const editorRoot = document.createElement('div')
  editorRoot.className = 'bn-editor'
  const block = document.createElement('div')
  block.setAttribute('data-node-type', 'blockContainer')
  block.setAttribute('data-id', domBlockId)
  const textTarget = document.createElement('p')
  textTarget.className = 'bn-inline-content'
  textTarget.textContent = text

  block.append(textTarget)
  editorRoot.append(block)
  document.body.append(editorRoot)

  return { textTarget }
}
