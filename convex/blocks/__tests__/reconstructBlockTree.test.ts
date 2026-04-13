import { afterEach, describe, expect, it, vi } from 'vitest'
import { reconstructBlockTree } from '../functions/reconstructBlockTree'
import { testBlockNoteId } from '../../_test/factories.helper'
import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'

function makeFlatBlock(overrides: Partial<Block> & { blockNoteId: string }): Block {
  return {
    _id: `blocks:${overrides.blockNoteId}` as Id<'blocks'>,
    _creationTime: 0,
    noteId: 'sidebarItems:note1' as Id<'sidebarItems'>,
    campaignId: 'campaigns:c1' as Id<'campaigns'>,
    parentBlockId: null,
    depth: 0,
    position: 0,
    type: 'paragraph',
    props: {},
    inlineContent: null,
    plainText: null,
    shareStatus: 'not_shared',
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: 'userProfiles:u1' as Id<'userProfiles'>,
    ...overrides,
  } as Block
}

describe('reconstructBlockTree', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array for empty input', () => {
    expect(reconstructBlockTree([])).toEqual([])
  })

  it('reconstructs a single top-level block', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('a'), type: 'paragraph', position: 0 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(testBlockNoteId('a'))
    expect(result[0].type).toBe('paragraph')
  })

  it('sorts top-level blocks by position', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('b'), position: 1 }),
      makeFlatBlock({ blockNoteId: testBlockNoteId('a'), position: 0 }),
      makeFlatBlock({ blockNoteId: testBlockNoteId('c'), position: 2 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result.map((b) => b.id)).toEqual([
      testBlockNoteId('a'),
      testBlockNoteId('b'),
      testBlockNoteId('c'),
    ])
  })

  it('nests children under their parent', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('parent'), position: 0 }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('child-1'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: 0,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('child-2'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: 1,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children![0].id).toBe(testBlockNoteId('child-1'))
    expect(result[0].children![1].id).toBe(testBlockNoteId('child-2'))
  })

  it('reconstructs deeply nested tree', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('root'), position: 0 }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('child'),
        parentBlockId: testBlockNoteId('root'),
        depth: 1,
        position: 0,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('grandchild'),
        parentBlockId: testBlockNoteId('child'),
        depth: 2,
        position: 0,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result[0].children![0].children![0].id).toBe(testBlockNoteId('grandchild'))
  })

  it('restores inlineContent as content', () => {
    const inlineContent = [{ type: 'text' as const, text: 'Hello', styles: {} }]
    const blocks = [makeFlatBlock({ blockNoteId: testBlockNoteId('a'), inlineContent })]
    const result = reconstructBlockTree(blocks)
    expect(result[0].content).toEqual(inlineContent)
  })

  it('sets content to undefined when inlineContent is null', () => {
    const blocks = [makeFlatBlock({ blockNoteId: testBlockNoteId('a'), inlineContent: null })]
    const result = reconstructBlockTree(blocks)
    expect(result[0].content).toBeUndefined()
  })

  it('drops orphaned blocks and logs warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('root'), position: 0 }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('orphan'),
        parentBlockId: testBlockNoteId('deleted-parent'),
        depth: 1,
        position: 0,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(testBlockNoteId('root'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(testBlockNoteId('deleted-parent')))
  })

  it('handles position collisions without crashing', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('parent'), position: 0 }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('a'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: 0,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('b'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: 0,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children!.map((c) => c.id)).toEqual(
      expect.arrayContaining([testBlockNoteId('a'), testBlockNoteId('b')]),
    )
  })

  it('returns empty array when all blocks are orphaned', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [
      makeFlatBlock({
        blockNoteId: testBlockNoteId('a'),
        parentBlockId: testBlockNoteId('missing-1'),
        depth: 1,
        position: 0,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('b'),
        parentBlockId: testBlockNoteId('missing-2'),
        depth: 1,
        position: 0,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('sets children to undefined for leaf blocks', () => {
    const blocks = [makeFlatBlock({ blockNoteId: testBlockNoteId('leaf'), position: 0 })]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].children).toBeUndefined()
  })

  it('sorts blocks with null positions as 0', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('explicit'), position: 1 }),
      makeFlatBlock({ blockNoteId: testBlockNoteId('null-pos'), position: null }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(testBlockNoteId('null-pos'))
    expect(result[1].id).toBe(testBlockNoteId('explicit'))
  })

  it('breaks cycles gracefully and logs warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('root'), parentBlockId: null, position: 0 }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('ca'),
        parentBlockId: testBlockNoteId('cb'),
        depth: 1,
        position: 0,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('cb'),
        parentBlockId: testBlockNoteId('ca'),
        depth: 1,
        position: 0,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(testBlockNoteId('root'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unreachable cycles'))
  })

  it('handles mixed null and numbered positions among siblings', () => {
    const blocks = [
      makeFlatBlock({ blockNoteId: testBlockNoteId('parent'), position: 0 }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('c-pos2'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: 2,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('c-null'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: null,
      }),
      makeFlatBlock({
        blockNoteId: testBlockNoteId('c-pos1'),
        parentBlockId: testBlockNoteId('parent'),
        depth: 1,
        position: 1,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    const children = result[0].children!
    expect(children).toHaveLength(3)
    expect(children[0].id).toBe(testBlockNoteId('c-null'))
    expect(children[1].id).toBe(testBlockNoteId('c-pos1'))
    expect(children[2].id).toBe(testBlockNoteId('c-pos2'))
  })
})
