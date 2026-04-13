import { describe, expect, it } from 'vitest'
import type { CustomBlock } from 'convex/notes/editorSpecs'
import {
  extractHeadingsFromContent,
  findHeadingByText,
  normalizeHeadingText,
  resolveHeadingPath,
} from '~/features/editor/utils/heading-utils'

function heading(
  id: string,
  text: string,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  children: Array<CustomBlock> = [],
): CustomBlock {
  return {
    id,
    type: 'heading',
    props: { level },
    content: [{ type: 'text', text, styles: {} }],
    children,
  } as unknown as CustomBlock
}

function paragraph(id: string, text: string, children: Array<CustomBlock> = []): CustomBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text, styles: {} }],
    children,
  } as unknown as CustomBlock
}

describe('normalizeHeadingText', () => {
  it('lowercases and trims', () => {
    expect(normalizeHeadingText('  Hello World  ')).toBe('hello world')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeHeadingText('Hello    World')).toBe('hello world')
  })
})

describe('extractHeadingsFromContent', () => {
  it('extracts headings from blocks', () => {
    const content: Array<CustomBlock> = [
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

  it('skips headings without text', () => {
    const content: Array<CustomBlock> = [heading('b1', '', 1)]
    expect(extractHeadingsFromContent(content)).toHaveLength(0)
  })

  it('defaults to level 1 for invalid levels', () => {
    const content: Array<CustomBlock> = [heading('b1', 'Bad Level', 5)]
    const headings = extractHeadingsFromContent(content)
    expect(headings[0].level).toBe(1)
  })

  it('processes nested children', () => {
    const content: Array<CustomBlock> = [paragraph('b1', '', [heading('b2', 'Nested', 3)])]
    const headings = extractHeadingsFromContent(content)
    expect(headings).toHaveLength(1)
    expect(headings[0].text).toBe('Nested')
  })
})

describe('findHeadingByText', () => {
  const headings = [
    {
      blockNoteId: 'b1',
      text: 'Introduction',
      level: 1 as const,
      normalizedText: 'introduction',
    },
    {
      blockNoteId: 'b2',
      text: 'Details',
      level: 2 as const,
      normalizedText: 'details',
    },
  ]

  it('finds heading by text (case-insensitive)', () => {
    expect(findHeadingByText(headings, 'INTRODUCTION')?.blockNoteId).toBe('b1')
  })

  it('returns undefined for non-existent heading', () => {
    expect(findHeadingByText(headings, 'Missing')).toBeUndefined()
  })
})

describe('resolveHeadingPath', () => {
  const headings = [
    {
      blockNoteId: 'b1',
      text: 'Chapter 1',
      level: 1 as const,
      normalizedText: 'chapter 1',
    },
    {
      blockNoteId: 'b2',
      text: 'Section A',
      level: 2 as const,
      normalizedText: 'section a',
    },
    {
      blockNoteId: 'b3',
      text: 'Section B',
      level: 2 as const,
      normalizedText: 'section b',
    },
  ]

  it('resolves single path segment', () => {
    expect(resolveHeadingPath(headings, ['Chapter 1'])?.blockNoteId).toBe('b1')
  })

  it('resolves chained path', () => {
    expect(resolveHeadingPath(headings, ['Chapter 1', 'Section B'])?.blockNoteId).toBe('b3')
  })

  it('returns undefined for empty path', () => {
    expect(resolveHeadingPath(headings, [])).toBeUndefined()
  })

  it('resolves to first match when duplicates exist', () => {
    const duplicateHeadings = [
      {
        blockNoteId: 'b1',
        text: 'Overview',
        level: 1 as const,
        normalizedText: 'overview',
      },
      {
        blockNoteId: 'b2',
        text: 'Overview',
        level: 2 as const,
        normalizedText: 'overview',
      },
    ]
    expect(resolveHeadingPath(duplicateHeadings, ['Overview'])?.blockNoteId).toBe('b1')
  })

  it('returns undefined when path segment not found', () => {
    expect(resolveHeadingPath(headings, ['Chapter 1', 'Missing'])).toBeUndefined()
  })
})
