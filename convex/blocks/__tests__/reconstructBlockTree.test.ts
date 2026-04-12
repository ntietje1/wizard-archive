import { afterEach, describe, expect, it, vi } from 'vitest'
import { reconstructBlockTree } from '../functions/reconstructBlockTree'
import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'

function makeFlatBlock(overrides: Partial<Block> & { blockId: string }): Block {
  return {
    _id: `blocks:${overrides.blockId}` as Id<'blocks'>,
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
    const blocks = [makeFlatBlock({ blockId: 'a', type: 'paragraph', position: 0 })]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
    expect(result[0].type).toBe('paragraph')
  })

  it('sorts top-level blocks by position', () => {
    const blocks = [
      makeFlatBlock({ blockId: 'b', position: 1 }),
      makeFlatBlock({ blockId: 'a', position: 0 }),
      makeFlatBlock({ blockId: 'c', position: 2 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result.map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('nests children under their parent', () => {
    const blocks = [
      makeFlatBlock({ blockId: 'parent', position: 0 }),
      makeFlatBlock({ blockId: 'child-1', parentBlockId: 'parent', depth: 1, position: 0 }),
      makeFlatBlock({ blockId: 'child-2', parentBlockId: 'parent', depth: 1, position: 1 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children![0].id).toBe('child-1')
    expect(result[0].children![1].id).toBe('child-2')
  })

  it('reconstructs deeply nested tree', () => {
    const blocks = [
      makeFlatBlock({ blockId: 'root', position: 0 }),
      makeFlatBlock({ blockId: 'child', parentBlockId: 'root', depth: 1, position: 0 }),
      makeFlatBlock({ blockId: 'grandchild', parentBlockId: 'child', depth: 2, position: 0 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result[0].children![0].children![0].id).toBe('grandchild')
  })

  it('restores inlineContent as content', () => {
    const inlineContent = [{ type: 'text' as const, text: 'Hello', styles: {} }]
    const blocks = [makeFlatBlock({ blockId: 'a', inlineContent })]
    const result = reconstructBlockTree(blocks)
    expect(result[0].content).toEqual(inlineContent)
  })

  it('sets content to undefined when inlineContent is null', () => {
    const blocks = [makeFlatBlock({ blockId: 'a', inlineContent: null })]
    const result = reconstructBlockTree(blocks)
    expect(result[0].content).toBeUndefined()
  })

  it('drops orphaned blocks and logs warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [
      makeFlatBlock({ blockId: 'root', position: 0 }),
      makeFlatBlock({
        blockId: 'orphan',
        parentBlockId: 'deleted-parent',
        depth: 1,
        position: 0,
      }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('root')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deleted-parent'))
  })

  it('handles position collisions without crashing', () => {
    const blocks = [
      makeFlatBlock({ blockId: 'parent', position: 0 }),
      makeFlatBlock({ blockId: 'a', parentBlockId: 'parent', depth: 1, position: 0 }),
      makeFlatBlock({ blockId: 'b', parentBlockId: 'parent', depth: 1, position: 0 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].children).toHaveLength(2)
    expect(result[0].children!.map((c) => c.id)).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('returns empty array when all blocks are orphaned', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [
      makeFlatBlock({ blockId: 'a', parentBlockId: 'missing-1', depth: 1, position: 0 }),
      makeFlatBlock({ blockId: 'b', parentBlockId: 'missing-2', depth: 1, position: 0 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
  })

  it('sets children to undefined for leaf blocks', () => {
    const blocks = [makeFlatBlock({ blockId: 'leaf', position: 0 })]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].children).toBeUndefined()
  })

  it('sorts blocks with null positions as 0', () => {
    const blocks = [
      makeFlatBlock({ blockId: 'explicit', position: 1 }),
      makeFlatBlock({ blockId: 'null-pos', position: null }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('null-pos')
    expect(result[1].id).toBe('explicit')
  })

  it('breaks cycles gracefully and logs warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const blocks = [
      makeFlatBlock({ blockId: 'root', parentBlockId: null, position: 0 }),
      makeFlatBlock({ blockId: 'a', parentBlockId: 'root', depth: 1, position: 0 }),
      makeFlatBlock({ blockId: 'a', parentBlockId: 'a', depth: 2, position: 0 }),
    ]
    const result = reconstructBlockTree(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('root')
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children![0].id).toBe('a')
    expect(result[0].children![0].children).toBeUndefined()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Cycle detected'))
  })

  it('handles mixed null and numbered positions among siblings', () => {
    const blocks = [
      makeFlatBlock({ blockId: 'parent', position: 0 }),
      makeFlatBlock({ blockId: 'c-pos2', parentBlockId: 'parent', depth: 1, position: 2 }),
      makeFlatBlock({ blockId: 'c-null', parentBlockId: 'parent', depth: 1, position: null }),
      makeFlatBlock({ blockId: 'c-pos1', parentBlockId: 'parent', depth: 1, position: 1 }),
    ]
    const result = reconstructBlockTree(blocks)
    const children = result[0].children!
    expect(children).toHaveLength(3)
    expect(children[0].id).toBe('c-null')
    expect(children[1].id).toBe('c-pos1')
    expect(children[2].id).toBe('c-pos2')
  })
})
