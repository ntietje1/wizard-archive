import { describe, expect, it, vi } from 'vitest'
import { getBlockShareTargetBlocks, getBlockShareTitle } from '../block-share-targets'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'

describe('block share targets', () => {
  it('uses the whole multi-block selection before the touched block', () => {
    const selectedBlocks = [block('selected-1'), block('selected-2')]
    const touchedBlock = block('touched')
    const editor = editorWith({
      selectionBlocks: selectedBlocks,
      fallbackBlock: touchedBlock,
    })

    expect(getBlockShareTargetBlocks(editor, touchedBlock.id)).toEqual(selectedBlocks)
  })

  it('falls back to the touched block when there is no multi-block selection', () => {
    const touchedBlock = block('touched')
    const editor = editorWith({
      selectionBlocks: [block('only-selected')],
      fallbackBlock: touchedBlock,
    })

    expect(getBlockShareTargetBlocks(editor, touchedBlock.id)).toEqual([touchedBlock])
  })

  it('formats the block share title with singular and plural counts', () => {
    expect(getBlockShareTitle(1)).toBe('Share 1 Block')
    expect(getBlockShareTitle(3)).toBe('Share 3 Blocks')
  })
})

function block(id: string): CustomBlock {
  return { id } as CustomBlock
}

function editorWith({
  selectionBlocks,
  fallbackBlock,
}: {
  selectionBlocks: Array<CustomBlock> | null
  fallbackBlock: CustomBlock | null
}): CustomBlockNoteEditor {
  return {
    getSelection: vi.fn(() =>
      selectionBlocks === null
        ? undefined
        : {
            blocks: selectionBlocks,
          },
    ),
    getBlock: vi.fn(() => fallbackBlock),
  } as unknown as CustomBlockNoteEditor
}
