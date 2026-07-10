import { describe, expect, it } from 'vite-plus/test'
import type { NoteBlock, HeadingLevel } from '../../document/model'
import { extractHeadingsFromContent, resolveHeadingPath } from '../heading-utils'

function heading(
  id: string,
  text: string,
  level: HeadingLevel,
  children: Array<NoteBlock> = [],
): NoteBlock {
  return {
    id,
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text, styles: {} }],
    children,
  } as unknown as NoteBlock
}

function paragraph(id: string, text: string, children: Array<NoteBlock> = []): NoteBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children,
  } as unknown as NoteBlock
}

describe('extractHeadingsFromContent', () => {
  it('extracts headings from blocks', () => {
    const content: Array<NoteBlock> = [
      heading('b1', 'Introduction', 1),
      paragraph('b2', 'body text'),
      heading('b3', 'Details', 2),
    ]
    const headings = extractHeadingsFromContent(content)
    expect(headings).toHaveLength(2)
    expect(headings[0].text).toBe('Introduction')
    expect(headings[0].level).toBe(1)
    expect(headings[1].text).toBe('Details')
    expect(headings[1].level).toBe(2)
  })

  it('processes nested children', () => {
    const content: Array<NoteBlock> = [paragraph('b1', '', [heading('b2', 'Nested', 3)])]
    const headings = extractHeadingsFromContent(content)
    expect(headings).toHaveLength(1)
    expect(headings[0].text).toBe('Nested')
  })

  it('continues into children when a parent heading has invalid props', () => {
    const invalidParent = {
      ...heading('b1', 'Broken Parent', 1, [heading('b2', 'Nested', 2)]),
      props: { level: 12 },
    } as unknown as NoteBlock

    expect(extractHeadingsFromContent([invalidParent]).map((entry) => entry.text)).toEqual([
      'Nested',
    ])
  })

  it('includes inline value chips in the visible heading text', () => {
    const content: Array<NoteBlock> = [
      {
        ...heading('b1', '', 1),
        content: [
          { type: 'text', text: 'DC ', styles: {} },
          {
            type: 'value',
            props: { valueId: 'value-1', slug: 'save_dc', expressionSource: '12' },
          },
        ],
      } as unknown as NoteBlock,
    ]

    expect(extractHeadingsFromContent(content)[0]).toMatchObject({
      text: 'DC save_dc',
      normalizedText: 'dc save_dc',
    })
  })
})

describe('resolveHeadingPath', () => {
  const headings = [
    {
      noteBlockId: 'b1',
      text: 'Chapter 1',
      level: 1 as const,
      normalizedText: 'chapter 1',
    },
    {
      noteBlockId: 'b2',
      text: 'Section A',
      level: 2 as const,
      normalizedText: 'section a',
    },
    {
      noteBlockId: 'b3',
      text: 'Section B',
      level: 2 as const,
      normalizedText: 'section b',
    },
  ]

  it('resolves single path segment', () => {
    expect(resolveHeadingPath(headings, ['Chapter 1'])?.noteBlockId).toBe('b1')
  })

  it('resolves chained path', () => {
    expect(resolveHeadingPath(headings, ['Chapter 1', 'Section B'])?.noteBlockId).toBe('b3')
  })

  it('keeps chained path matching inside the matched heading subtree', () => {
    const nestedHeadings = [
      {
        noteBlockId: 'chapter-1',
        text: 'Chapter',
        level: 1 as const,
        normalizedText: 'chapter',
      },
      {
        noteBlockId: 'chapter-1-scene',
        text: 'Scene',
        level: 2 as const,
        normalizedText: 'scene',
      },
      {
        noteBlockId: 'chapter-2',
        text: 'Chapter',
        level: 1 as const,
        normalizedText: 'chapter',
      },
      {
        noteBlockId: 'chapter-2-secret',
        text: 'Secret',
        level: 2 as const,
        normalizedText: 'secret',
      },
    ]

    expect(resolveHeadingPath(nestedHeadings, ['Chapter', 'Secret'])).toBeUndefined()
  })

  it('resolves to first match when duplicates exist', () => {
    const duplicateHeadings = [
      {
        noteBlockId: 'b1',
        text: 'Overview',
        level: 1 as const,
        normalizedText: 'overview',
      },
      {
        noteBlockId: 'b2',
        text: 'Overview',
        level: 2 as const,
        normalizedText: 'overview',
      },
    ]
    expect(resolveHeadingPath(duplicateHeadings, ['Overview'])?.noteBlockId).toBe('b1')
  })
})
