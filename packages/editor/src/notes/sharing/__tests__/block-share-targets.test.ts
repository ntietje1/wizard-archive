import { describe, expect, it, vi } from 'vite-plus/test'
import {
  getBlockShareActionLabel,
  getBlockShareButtonLabel,
  getBlockShareTargetBlocks,
  getBlockShareTitle,
} from '../block-share-targets'
import type { NoteBlock } from '../../document/model'
import type { CustomBlockNoteEditor } from '../../editor-schema'

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

  it('formats block share labels from one shared model', () => {
    expect(getBlockShareTitle(1)).toBe('Share 1 Block')
    expect(getBlockShareTitle(3)).toBe('Share 3 Blocks')
    expect(getBlockShareButtonLabel(1)).toBe('Share')
    expect(getBlockShareButtonLabel(3)).toBe('Share 3 blocks')
    expect(getBlockShareActionLabel(1, 'visible')).toBe('Unshare 1 Block')
    expect(getBlockShareActionLabel(3, 'mixed')).toBe('Share 3 Blocks')
  })
})

function block(id: string): NoteBlock {
  return { id } as NoteBlock
}

function editorWith({
  selectionBlocks,
  fallbackBlock,
}: {
  selectionBlocks: Array<NoteBlock> | null
  fallbackBlock: NoteBlock | null
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
