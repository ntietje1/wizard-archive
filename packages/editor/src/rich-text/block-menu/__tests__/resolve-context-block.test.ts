import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { resolveRichTextContextBlock } from '../resolve-context-block'
import type { RichTextBlockMenuEditor } from '../block-menu'

const getNearestBlockPos = vi.hoisted(() => vi.fn())

vi.mock('@blocknote/core', async (importOriginal) => ({
  ...(await importOriginal()),
  getNearestBlockPos,
}))

afterEach(() => {
  document.body.replaceChildren()
  getNearestBlockPos.mockReset()
})

describe('resolveRichTextContextBlock', () => {
  it('prefers the ProseMirror block at the pointer over a stale rendered id', () => {
    const target = createBlockTarget('stale-block')
    const canonicalBlock = block('canonical-block')
    const posAtCoords = vi.fn(() => ({ pos: 42 }))
    const editor = {
      getBlock: vi.fn((id: string) => (id === canonicalBlock.id ? canonicalBlock : undefined)),
      prosemirrorView: {
        posAtCoords,
        state: { doc: {} },
      },
    } as unknown as RichTextBlockMenuEditor
    getNearestBlockPos.mockReturnValue({ node: { attrs: { id: canonicalBlock.id } } })

    expect(
      resolveRichTextContextBlock(editor, {
        position: { x: 10, y: 20 },
        target,
      }),
    ).toBe(canonicalBlock)
    expect(posAtCoords).toHaveBeenCalledWith({ left: 10, top: 20 })
  })

  it('falls back to the rendered block id when coordinates cannot be resolved', () => {
    const target = createBlockTarget('rendered-block')
    const renderedBlock = block('rendered-block')
    const editor = {
      getBlock: vi.fn(() => renderedBlock),
      prosemirrorView: {
        posAtCoords: vi.fn(() => null),
        posAtDOM: vi.fn(() => {
          throw new Error('DOM position unavailable')
        }),
        state: { doc: {} },
      },
    } as unknown as RichTextBlockMenuEditor

    expect(
      resolveRichTextContextBlock(editor, {
        position: { x: 10, y: 20 },
        target,
      }),
    ).toBe(renderedBlock)
  })

  it('uses the ProseMirror DOM position before a stale rendered id', () => {
    const target = createBlockTarget('stale-block')
    const canonicalBlock = block('canonical-block')
    const posAtDOM = vi.fn(() => 73)
    const editor = {
      getBlock: vi.fn((id: string) => (id === canonicalBlock.id ? canonicalBlock : undefined)),
      prosemirrorView: {
        posAtCoords: vi.fn(() => null),
        posAtDOM,
        state: { doc: {} },
      },
    } as unknown as RichTextBlockMenuEditor
    getNearestBlockPos.mockReturnValue({ node: { attrs: { id: canonicalBlock.id } } })

    expect(
      resolveRichTextContextBlock(editor, {
        position: { x: 10, y: 20 },
        target,
      }),
    ).toBe(canonicalBlock)
    expect(posAtDOM).toHaveBeenCalledWith(target.parentElement, 0)
  })
})

function createBlockTarget(id: string) {
  const container = document.createElement('div')
  container.dataset.nodeType = 'blockContainer'
  container.dataset.id = id
  const target = document.createElement('span')
  container.append(target)
  document.body.append(container)
  return target
}

function block(id: string) {
  return { id, type: 'paragraph', props: {}, content: [], children: [] }
}
