import { describe, expect, it, vi } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  generateDomainId,
  generateUuidV7,
  isUuidV7,
} from '../../../../resources/domain-id'
import {
  NOTE_YJS_FRAGMENT,
  noteBlocksToYDoc,
  noteYDocToBlocks,
} from '../../../document/headless-yjs'
import { duplicateNoteBlock } from '../duplicate-note-block'

describe('duplicateNoteBlock', () => {
  it('allocates new block and Value identities while preserving copied formula relationships', () => {
    const firstValueId = generateUuidV7()
    const secondValueId = generateUuidV7()
    const [source] = noteYDocToBlocks(
      noteBlocksToYDoc(
        [
          {
            id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
            type: 'paragraph',
            content: [
              {
                type: 'value',
                props: {
                  valueId: firstValueId,
                  label: 'Base',
                  expressionSource: '10',
                },
              },
              {
                type: 'value',
                props: {
                  valueId: secondValueId,
                  label: 'Derived',
                  expressionSource: `{{${firstValueId}}} * 2`,
                },
              },
            ],
            children: [
              {
                id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
                type: 'paragraph',
                content: [{ type: 'text', text: 'Nested block' }],
              },
            ],
          },
        ],
        NOTE_YJS_FRAGMENT,
      ),
      NOTE_YJS_FRAGMENT,
    )
    if (!source) throw new Error('Expected source block')

    type Editor = Parameters<typeof duplicateNoteBlock>[0]
    type InsertBlocksArguments = Parameters<Editor['insertBlocks']>
    type InsertBlocksResult = ReturnType<Editor['insertBlocks']>
    const insertedBlock = source as unknown as InsertBlocksResult[number]
    let copiedBlocks: InsertBlocksArguments[0] | undefined
    let referenceBlock: InsertBlocksArguments[1] | undefined
    let placement: InsertBlocksArguments[2] | undefined
    const insertBlocks = vi.fn(
      (
        blocks: InsertBlocksArguments[0],
        reference: InsertBlocksArguments[1],
        blockPlacement: InsertBlocksArguments[2],
      ) => {
        copiedBlocks = blocks
        referenceBlock = reference
        placement = blockPlacement
        return [insertedBlock] as InsertBlocksResult
      },
    )
    const setTextCursorPosition = vi.fn()
    duplicateNoteBlock(
      {
        insertBlocks,
        setTextCursorPosition,
      } as unknown as Parameters<typeof duplicateNoteBlock>[0],
      source as unknown as Parameters<typeof duplicateNoteBlock>[1],
    )
    expect(insertBlocks).toHaveBeenCalledOnce()
    const [copied] = copiedBlocks ?? []
    if (!copied) throw new Error('Expected copied block')
    const copiedValues = Array.isArray(copied.content) ? copied.content.filter(isCopiedValue) : []
    const [copiedBase, copiedDerived] = copiedValues
    if (copiedBase?.type !== 'value' || copiedDerived?.type !== 'value') {
      throw new Error('Expected copied Values')
    }

    expect(copied.id).not.toBe(source.id)
    expect(isUuidV7(copied.id ?? '')).toBe(true)
    expect(copied.children?.[0]?.id).not.toBe(source.children?.[0]?.id)
    expect(isUuidV7(copied.children?.[0]?.id ?? '')).toBe(true)
    expect(copiedBase.props.valueId).not.toBe(firstValueId)
    expect(copiedDerived.props.valueId).not.toBe(secondValueId)
    expect(copiedDerived.props.expressionSource).toBe(`{{${copiedBase.props.valueId}}} * 2`)
    expect(referenceBlock).toBe(source)
    expect(placement).toBe('after')
    expect(setTextCursorPosition).toHaveBeenCalledWith(insertedBlock, 'end')
  })
})

function isCopiedValue(item: unknown): item is {
  type: 'value'
  props: { expressionSource: string; label: string; valueId: string }
} {
  if (!item || typeof item !== 'object') return false
  const candidate = item as { props?: unknown; type?: unknown }
  if (candidate.type !== 'value' || !candidate.props || typeof candidate.props !== 'object') {
    return false
  }
  const props = candidate.props as Record<string, unknown>
  return (
    typeof props.valueId === 'string' &&
    typeof props.label === 'string' &&
    typeof props.expressionSource === 'string'
  )
}
