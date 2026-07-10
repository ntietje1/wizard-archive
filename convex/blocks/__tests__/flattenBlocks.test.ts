import { describe, expect, it } from 'vitest'
import { flattenBlocks } from '../functions/flattenBlocks'
import { reconstructBlockTree } from '../functions/reconstructBlockTree'
import { parseBlockNoteBlocks } from '../parseBlockNoteBlocks'
import { testBlockNoteId } from '../../_test/factories.helper'
import type { NoteBlock, InlineContent } from '@wizard-archive/editor/notes/document-contract'
import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'

type TableContent = {
  type: 'tableContent'
  columnWidths: Array<number>
  rows: Array<{ cells: Array<{ type: 'tableCell'; content: InlineContent }> }>
}
type TestBlockOverrides = Partial<Omit<NoteBlock, 'content' | 'props' | 'children'>> & {
  content?: unknown
  props?: unknown
  children?: Array<NoteBlock>
}

function makeBlock(label: string, overrides?: TestBlockOverrides): NoteBlock {
  return {
    id: testBlockNoteId(label),
    type: 'paragraph',
    props: {},
    content: [],
    ...overrides,
  } as NoteBlock
}

function toFakeBlocks(flat: ReturnType<typeof flattenBlocks>): Array<Block> {
  return flat.map(
    (f) =>
      ({
        _id: `blocks:${f.blockNoteId}` as Id<'blocks'>,
        _creationTime: 0,
        noteId: 'sidebarItems:n' as Id<'sidebarItems'>,
        campaignId: 'campaigns:c' as Id<'campaigns'>,
        blockNoteId: f.blockNoteId,
        parentBlockId: f.parentBlockId,
        depth: f.depth,
        position: f.position,
        type: f.type,
        props: f.props,
        content: f.content,
        plainText: f.plainText,
        shareStatus: 'not_shared',
      }) as Block,
  )
}

describe('flattenBlocks', () => {
  it('returns empty array for empty input', () => {
    expect(flattenBlocks([])).toEqual([])
  })

  it('normalizes legacy embed content and height before flattening', () => {
    const [embedBlock] = parseBlockNoteBlocks([
      {
        id: testBlockNoteId('embed'),
        type: 'embed',
        content: [{ type: 'text', text: 'legacy caption', styles: {} }],
        props: {
          targetKind: 'externalUrl',
          name: 'clip.mp3',
          url: 'https://example.com/clip.mp3',
          previewWidth: 320,
          previewHeight: 180,
        },
      },
    ])

    const [flatBlock] = flattenBlocks([embedBlock])
    expect(flatBlock.props).toMatchObject({
      targetKind: 'externalUrl',
      name: 'clip.mp3',
      previewWidth: 320,
    })
    expect(flatBlock.props).not.toHaveProperty('previewHeight')
    expect(flatBlock.content).toBeNull()
    expect(flatBlock).not.toHaveProperty('inlineContent')
  })

  it('flattens a single top-level block', () => {
    const blocks = [makeBlock('a')]
    const result = flattenBlocks(blocks)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      blockNoteId: testBlockNoteId('a'),
      parentBlockId: null,
      depth: 0,
      position: 0,
      type: 'paragraph',
    })
  })

  it('preserves sibling positions', () => {
    const blocks = [makeBlock('a'), makeBlock('b'), makeBlock('c')]
    const result = flattenBlocks(blocks)
    expect(result).toHaveLength(3)
    expect(result[0].position).toBe(0)
    expect(result[1].position).toBe(1)
    expect(result[2].position).toBe(2)
    expect(result.every((b) => b.parentBlockId === null)).toBe(true)
  })

  it('flattens nested children with correct parentBlockId and depth', () => {
    const blocks = [
      makeBlock('parent', {
        children: [
          makeBlock('child-1'),
          makeBlock('child-2', {
            children: [makeBlock('grandchild')],
          }),
        ],
      }),
    ]
    const result = flattenBlocks(blocks)
    expect(result).toHaveLength(4)

    const parent = result.find((b) => b.blockNoteId === testBlockNoteId('parent'))
    expect(parent).toBeDefined()
    const child1 = result.find((b) => b.blockNoteId === testBlockNoteId('child-1'))!
    const child2 = result.find((b) => b.blockNoteId === testBlockNoteId('child-2'))!
    const grandchild = result.find((b) => b.blockNoteId === testBlockNoteId('grandchild'))!
    expect(parent!.parentBlockId).toBeNull()
    expect(parent!.depth).toBe(0)
    expect(child1.parentBlockId).toBe(testBlockNoteId('parent'))
    expect(child1.depth).toBe(1)
    expect(child1.position).toBe(0)
    expect(child2.parentBlockId).toBe(testBlockNoteId('parent'))
    expect(child2.depth).toBe(1)
    expect(child2.position).toBe(1)
    expect(grandchild.parentBlockId).toBe(testBlockNoteId('child-2'))
    expect(grandchild.depth).toBe(2)
    expect(grandchild.position).toBe(0)
  })

  it('extracts plainText from inline content', () => {
    const blocks = [
      makeBlock('a', {
        content: [
          { type: 'text', text: 'Hello', styles: {} },
          { type: 'text', text: 'world', styles: {} },
        ] satisfies InlineContent,
      }),
    ]
    const result = flattenBlocks(blocks)
    expect(result[0].plainText).toBe('Hello world')
  })

  it('extracts plainText from table content', () => {
    const blocks = [
      makeBlock('t', {
        type: 'table',
        content: {
          type: 'tableContent',
          columnWidths: [100],
          rows: [
            {
              cells: [{ type: 'tableCell', content: [{ type: 'text', text: 'Cell', styles: {} }] }],
            },
          ],
        } satisfies TableContent,
      }),
    ]
    const result = flattenBlocks(blocks)
    expect(result[0].plainText).toBe('Cell')
    expect(result[0]).not.toHaveProperty('inlineContent')
  })

  it('rejects malformed value inline content', () => {
    expect(() =>
      parseBlockNoteBlocks([
        {
          id: testBlockNoteId('bad-value'),
          type: 'paragraph',
          props: {},
          content: [{ type: 'value', props: { slug: 'missing-fields' } }],
        },
      ]),
    ).toThrow(/VALIDATION_FAILED/)
  })

  it('rejects malformed table cell content', () => {
    expect(() =>
      parseBlockNoteBlocks([
        {
          id: testBlockNoteId('bad-table'),
          type: 'table',
          props: {},
          content: {
            type: 'tableContent',
            columnWidths: [null],
            rows: [{ cells: [{ type: 'tableCell', content: [{ type: 'text' }] }] }],
          },
        },
      ]),
    ).toThrow(/VALIDATION_FAILED/)
  })

  it('sets content to null when block has no content', () => {
    const blocks = [makeBlock('d', { type: 'divider', content: undefined })]
    const result = flattenBlocks(blocks)
    expect(result[0].content).toBeNull()
    expect(result[0]).not.toHaveProperty('inlineContent')
  })

  it('no output block has a children key', () => {
    const blocks = [
      makeBlock('a', {
        children: [makeBlock('b')],
      }),
    ]
    const result = flattenBlocks(blocks)
    for (const flat of result) {
      expect('children' in flat).toBe(false)
    }
  })

  it('treats empty children array the same as no children', () => {
    const blocks = [makeBlock('a', { children: [] })]
    const result = flattenBlocks(blocks)
    expect(result).toHaveLength(1)
    expect(result[0].blockNoteId).toBe(testBlockNoteId('a'))
  })

  it('flattens multiple root blocks each with nested children', () => {
    const blocks = [
      makeBlock('r1', { children: [makeBlock('c1')] }),
      makeBlock('r2', { children: [makeBlock('c2')] }),
    ]
    const result = flattenBlocks(blocks)
    expect(result).toHaveLength(4)

    const r1 = result.find((b) => b.blockNoteId === testBlockNoteId('r1'))!
    const r2 = result.find((b) => b.blockNoteId === testBlockNoteId('r2'))!
    const c1 = result.find((b) => b.blockNoteId === testBlockNoteId('c1'))!
    const c2 = result.find((b) => b.blockNoteId === testBlockNoteId('c2'))!

    expect(r1).toMatchObject({ parentBlockId: null, depth: 0, position: 0 })
    expect(r2).toMatchObject({ parentBlockId: null, depth: 0, position: 1 })
    expect(c1).toMatchObject({ parentBlockId: testBlockNoteId('r1'), depth: 1, position: 0 })
    expect(c2).toMatchObject({ parentBlockId: testBlockNoteId('r2'), depth: 1, position: 0 })
  })

  it('round-trips through flatten then reconstruct producing equivalent tree', () => {
    const original = [
      makeBlock('h1', {
        type: 'heading',
        props: { level: 1 },
        content: [{ type: 'text', text: 'Title', styles: {} }] satisfies InlineContent,
        children: [
          makeBlock('p1', {
            content: [{ type: 'text', text: 'Paragraph', styles: {} }] satisfies InlineContent,
            children: [makeBlock('nested', { type: 'bulletListItem' })],
          }),
        ],
      }),
      makeBlock('d1', { type: 'divider', content: undefined }),
    ]

    const flat = flattenBlocks(original)
    const reconstructed = reconstructBlockTree(toFakeBlocks(flat))

    expect(reconstructed).toHaveLength(2)
    expect(reconstructed[0].id).toBe(testBlockNoteId('h1'))
    expect(reconstructed[0].type).toBe('heading')
    expect(reconstructed[0].children).toHaveLength(1)
    expect(reconstructed[0].children![0].id).toBe(testBlockNoteId('p1'))
    expect(reconstructed[0].children![0].children).toHaveLength(1)
    expect(reconstructed[0].children![0].children![0].id).toBe(testBlockNoteId('nested'))
    expect(reconstructed[0].children![0].children![0].type).toBe('bulletListItem')
    expect(reconstructed[1].id).toBe(testBlockNoteId('d1'))
    expect(reconstructed[1].type).toBe('divider')
    expect(reconstructed[1].content).toBeUndefined()
    expect(reconstructed[1].children).toBeUndefined()
  })

  it('flattens and round-trips a 6-level deep tree', () => {
    const tree = [
      makeBlock('d0', {
        children: [
          makeBlock('d1', {
            children: [
              makeBlock('d2', {
                children: [
                  makeBlock('d3', {
                    children: [
                      makeBlock('d4', {
                        children: [makeBlock('d5')],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ]

    const flat = flattenBlocks(tree)
    expect(flat).toHaveLength(6)

    for (let i = 0; i < 6; i++) {
      const block = flat.find((b) => b.blockNoteId === testBlockNoteId(`d${i}`))!
      expect(block.depth).toBe(i)
      expect(block.position).toBe(0)
      expect(block.parentBlockId).toBe(i === 0 ? null : testBlockNoteId(`d${i - 1}`))
    }

    const reconstructed = reconstructBlockTree(toFakeBlocks(flat))
    expect(reconstructed).toHaveLength(1)

    let node = reconstructed[0]
    for (let i = 0; i < 5; i++) {
      expect(node.id).toBe(testBlockNoteId(`d${i}`))
      expect(node.children).toHaveLength(1)
      node = node.children![0]
    }
    expect(node.id).toBe(testBlockNoteId('d5'))
    expect(node.children).toBeUndefined()
  })

  it('flattens a wide tree with multiple siblings at each depth', () => {
    const tree = [
      makeBlock('r1', {
        type: 'heading',
        children: [
          makeBlock('r1-c0', {
            children: [makeBlock('r1-c0-g0'), makeBlock('r1-c0-g1')],
          }),
          makeBlock('r1-c1', {
            children: [makeBlock('r1-c1-g0')],
          }),
          makeBlock('r1-c2'),
        ],
      }),
      makeBlock('r2', {
        children: [makeBlock('r2-c0'), makeBlock('r2-c1')],
      }),
    ]

    const flat = flattenBlocks(tree)
    expect(flat).toHaveLength(10)

    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r1'))!).toMatchObject({
      parentBlockId: null,
      depth: 0,
      position: 0,
    })
    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r2'))!).toMatchObject({
      parentBlockId: null,
      depth: 0,
      position: 1,
    })

    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r1-c0'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r1'),
      depth: 1,
      position: 0,
    })
    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r1-c1'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r1'),
      depth: 1,
      position: 1,
    })
    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r1-c2'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r1'),
      depth: 1,
      position: 2,
    })

    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r1-c0-g0'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r1-c0'),
      depth: 2,
      position: 0,
    })
    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r1-c0-g1'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r1-c0'),
      depth: 2,
      position: 1,
    })

    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r2-c0'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r2'),
      depth: 1,
      position: 0,
    })
    expect(flat.find((b) => b.blockNoteId === testBlockNoteId('r2-c1'))!).toMatchObject({
      parentBlockId: testBlockNoteId('r2'),
      depth: 1,
      position: 1,
    })

    const reconstructed = reconstructBlockTree(toFakeBlocks(flat))
    expect(reconstructed).toHaveLength(2)
    expect(reconstructed[0].children).toHaveLength(3)
    expect(reconstructed[0].children![0].children).toHaveLength(2)
    expect(reconstructed[0].children![1].children).toHaveLength(1)
    expect(reconstructed[0].children![2].children).toBeUndefined()
    expect(reconstructed[1].children).toHaveLength(2)
  })
})

/**
 * Normalizes a NoteBlock tree for deep comparison by stripping
 * undefined children/content to canonical form (undefined → omitted).
 */
function normalizeTree(blocks: Array<NoteBlock>): Array<Record<string, unknown>> {
  return blocks.map((b) => {
    const normalized: Record<string, unknown> = {
      id: b.id,
      type: b.type,
      props: b.props,
    }
    if (b.content !== undefined) normalized.content = b.content
    if (b.children && b.children.length > 0) {
      normalized.children = normalizeTree(b.children as Array<NoteBlock>)
    }
    return normalized
  })
}

function flattenRoundTrip(blocks: Array<NoteBlock>): Array<Record<string, unknown>> {
  const flat = flattenBlocks(blocks)
  const reconstructed = reconstructBlockTree(toFakeBlocks(flat))
  return normalizeTree(reconstructed)
}

describe('flatten ↔ reconstruct symmetry', () => {
  it('preserves id, type, props, and inline content through round-trip', () => {
    const original = [
      makeBlock('p1', {
        content: [
          { type: 'text', text: 'Hello', styles: { bold: true } },
          { type: 'text', text: ' world', styles: {} },
        ] satisfies InlineContent,
      }),
      makeBlock('h1', {
        type: 'heading',
        props: { level: 2, textColor: 'red' },
        content: [{ type: 'text', text: 'Header', styles: {} }] satisfies InlineContent,
      }),
      makeBlock('div', { type: 'divider', content: undefined }),
    ]

    expect(flattenRoundTrip(original)).toEqual(normalizeTree(original))
  })

  it('preserves nested structure with props and content at every depth', () => {
    const original = [
      makeBlock('root', {
        type: 'toggleListItem',
        content: [{ type: 'text', text: 'Root', styles: { italic: true } }] satisfies InlineContent,
        children: [
          makeBlock('c1', {
            type: 'numberedListItem',
            props: { start: 5 },
            content: [{ type: 'text', text: 'Numbered', styles: {} }] satisfies InlineContent,
            children: [
              makeBlock('gc1', {
                type: 'checkListItem',
                props: { checked: true },
                content: [{ type: 'text', text: 'Done', styles: {} }] satisfies InlineContent,
              }),
              makeBlock('gc2', {
                type: 'codeBlock',
                props: { language: 'typescript' },
                content: [
                  { type: 'text', text: 'const x = 1', styles: {} },
                ] satisfies InlineContent,
              }),
            ],
          }),
          makeBlock('c2', {
            content: [{ type: 'text', text: 'Sibling', styles: {} }] satisfies InlineContent,
          }),
        ],
      }),
    ]

    expect(flattenRoundTrip(original)).toEqual(normalizeTree(original))
  })

  it('flatten is stable: flattening the same tree twice produces identical output', () => {
    const tree = [
      makeBlock('a', {
        children: [makeBlock('b', { children: [makeBlock('c')] }), makeBlock('d')],
      }),
    ]

    const first = flattenBlocks(tree)
    const second = flattenBlocks(tree)
    expect(first).toEqual(second)
  })

  it('double round-trip is idempotent', () => {
    const original = [
      makeBlock('x', {
        type: 'quote',
        props: { textColor: 'green' },
        content: [
          { type: 'text', text: 'Quote', styles: { strike: true } },
        ] satisfies InlineContent,
        children: [
          makeBlock('y', {
            children: [makeBlock('z', { type: 'divider', content: undefined })],
          }),
        ],
      }),
    ]

    const firstPass = flattenRoundTrip(original)
    const secondPass = flattenRoundTrip(firstPass as unknown as Array<NoteBlock>)
    expect(secondPass).toEqual(firstPass)
  })

  it('reconstruct → flatten → reconstruct is stable', () => {
    const fakeBlocks: Array<Block> = [
      {
        blockNoteId: testBlockNoteId('a'),
        parentBlockId: null,
        depth: 0,
        position: 0,
        type: 'heading',
        props: { level: 3 },
        content: [{ type: 'text', text: 'Hi', styles: {} }],
      },
      {
        blockNoteId: testBlockNoteId('b'),
        parentBlockId: testBlockNoteId('a'),
        depth: 1,
        position: 0,
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: 'Child', styles: {} }],
      },
      {
        blockNoteId: testBlockNoteId('c'),
        parentBlockId: testBlockNoteId('a'),
        depth: 1,
        position: 1,
        type: 'divider',
        props: {},
        content: null,
      },
    ].map(
      (b) =>
        ({
          _id: `blocks:${b.blockNoteId}` as Id<'blocks'>,
          _creationTime: 0,
          noteId: 'sidebarItems:n' as Id<'sidebarItems'>,
          campaignId: 'campaigns:c' as Id<'campaigns'>,
          plainText: '',
          shareStatus: 'not_shared',
          ...b,
        }) as Block,
    )

    const tree1 = reconstructBlockTree(fakeBlocks)
    const flat = flattenBlocks(tree1)
    const tree2 = reconstructBlockTree(toFakeBlocks(flat))

    expect(normalizeTree(tree2)).toEqual(normalizeTree(tree1))
  })

  it('reconstructs persisted embeds as atomic blocks', () => {
    const legacyStoredEmbed = {
      _id: `blocks:${testBlockNoteId('persisted-embed')}` as Id<'blocks'>,
      _creationTime: 0,
      noteId: 'sidebarItems:n' as Id<'sidebarItems'>,
      campaignId: 'campaigns:c' as Id<'campaigns'>,
      blockNoteId: testBlockNoteId('persisted-embed'),
      parentBlockId: null,
      depth: 0,
      position: 0,
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        previewWidth: 320,
        previewHeight: 180,
      },
      content: [{ type: 'text', text: 'legacy caption', styles: {} }],
      inlineContent: [{ type: 'text', text: 'legacy caption', styles: {} }],
      plainText: 'legacy caption',
      shareStatus: 'not_shared',
    } as unknown as Block

    const [block] = reconstructBlockTree([legacyStoredEmbed])

    expect(block).toEqual({
      id: testBlockNoteId('persisted-embed'),
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        previewWidth: 320,
      },
    })
  })
})
