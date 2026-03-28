import { describe, expect, it } from 'vitest'
import {
  extractHeadingsFromContent,
  findHeadingByText,
  normalizeHeadingText,
  resolveHeadingPath,
} from '~/features/editor/utils/heading-utils'

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
    const content = [
      {
        id: 'b1',
        type: 'heading' as const,
        props: { level: 1 },
        content: [{ type: 'text', text: 'Introduction' }],
        children: [],
      },
      {
        id: 'b2',
        type: 'paragraph' as const,
        props: {},
        content: [{ type: 'text', text: 'body text' }],
        children: [],
      },
      {
        id: 'b3',
        type: 'heading' as const,
        props: { level: 2 },
        content: [{ type: 'text', text: 'Details' }],
        children: [],
      },
    ]
    const headings = extractHeadingsFromContent(content)
    expect(headings).toHaveLength(2)
    expect(headings[0].text).toBe('Introduction')
    expect(headings[0].level).toBe(1)
    expect(headings[1].text).toBe('Details')
    expect(headings[1].level).toBe(2)
  })

  it('skips headings without text', () => {
    const content = [
      {
        id: 'b1',
        type: 'heading' as const,
        props: { level: 1 },
        content: [],
        children: [],
      },
    ]
    expect(extractHeadingsFromContent(content)).toHaveLength(0)
  })

  it('skips headings without id', () => {
    const content = [
      {
        type: 'heading' as const,
        props: { level: 1 },
        content: [{ type: 'text', text: 'No ID' }],
        children: [],
      },
    ]
    expect(extractHeadingsFromContent(content)).toHaveLength(0)
  })

  it('defaults to level 1 for invalid levels', () => {
    const content = [
      {
        id: 'b1',
        type: 'heading' as const,
        props: { level: 5 },
        content: [{ type: 'text', text: 'Bad Level' }],
        children: [],
      },
    ]
    const headings = extractHeadingsFromContent(content)
    expect(headings[0].level).toBe(1)
  })

  it('processes nested children', () => {
    const content = [
      {
        id: 'b1',
        type: 'paragraph' as const,
        props: {},
        content: [],
        children: [
          {
            id: 'b2',
            type: 'heading' as const,
            props: { level: 3 },
            content: [{ type: 'text', text: 'Nested' }],
            children: [],
          },
        ],
      },
    ]
    const headings = extractHeadingsFromContent(content)
    expect(headings).toHaveLength(1)
    expect(headings[0].text).toBe('Nested')
  })
})

describe('findHeadingByText', () => {
  const headings = [
    {
      blockId: 'b1',
      text: 'Introduction',
      level: 1 as const,
      normalizedText: 'introduction',
    },
    {
      blockId: 'b2',
      text: 'Details',
      level: 2 as const,
      normalizedText: 'details',
    },
  ]

  it('finds heading by text (case-insensitive)', () => {
    expect(findHeadingByText(headings, 'INTRODUCTION')?.blockId).toBe('b1')
  })

  it('returns undefined for non-existent heading', () => {
    expect(findHeadingByText(headings, 'Missing')).toBeUndefined()
  })
})

describe('resolveHeadingPath', () => {
  const headings = [
    {
      blockId: 'b1',
      text: 'Chapter 1',
      level: 1 as const,
      normalizedText: 'chapter 1',
    },
    {
      blockId: 'b2',
      text: 'Section A',
      level: 2 as const,
      normalizedText: 'section a',
    },
    {
      blockId: 'b3',
      text: 'Section B',
      level: 2 as const,
      normalizedText: 'section b',
    },
  ]

  it('resolves single path segment', () => {
    expect(resolveHeadingPath(headings, ['Chapter 1'])?.blockId).toBe('b1')
  })

  it('resolves chained path', () => {
    expect(
      resolveHeadingPath(headings, ['Chapter 1', 'Section B'])?.blockId,
    ).toBe('b3')
  })

  it('returns undefined for empty path', () => {
    expect(resolveHeadingPath(headings, [])).toBeUndefined()
  })

  it('resolves to first match when duplicates exist', () => {
    const duplicateHeadings = [
      {
        blockId: 'b1',
        text: 'Overview',
        level: 1 as const,
        normalizedText: 'overview',
      },
      {
        blockId: 'b2',
        text: 'Overview',
        level: 2 as const,
        normalizedText: 'overview',
      },
    ]
    expect(resolveHeadingPath(duplicateHeadings, ['Overview'])?.blockId).toBe(
      'b1',
    )
  })

  it('returns undefined when path segment not found', () => {
    expect(
      resolveHeadingPath(headings, ['Chapter 1', 'Missing']),
    ).toBeUndefined()
  })
})
