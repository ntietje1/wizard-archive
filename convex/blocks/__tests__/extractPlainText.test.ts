import { describe, expect, it } from 'vitest'
import { extractPlainText } from '../functions/extractPlainText'
import type { FlatBlockContent } from '../types'

describe('extractPlainText', () => {
  it('returns null for blocks with no content', () => {
    const block: FlatBlockContent = { type: 'divider', props: {} }
    expect(extractPlainText(block)).toBeNull()
  })

  it('returns null for blocks with empty content array', () => {
    const block: FlatBlockContent = { type: 'paragraph', props: {}, content: [] }
    expect(extractPlainText(block)).toBeNull()
  })

  it('space-separates text from inline content', () => {
    const block: FlatBlockContent = {
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Hello', styles: {} },
        { type: 'text', text: 'world', styles: {} },
      ],
    }
    expect(extractPlainText(block)).toBe('Hello world')
  })

  it('extracts text from table content', () => {
    const block: FlatBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [100, 100],
        rows: [
          {
            cells: [
              [{ type: 'text', text: 'Cell 1', styles: {} }],
              [{ type: 'text', text: 'Cell 2', styles: {} }],
            ],
          },
        ],
      },
    }
    expect(extractPlainText(block)).toBe('Cell 1 Cell 2')
  })

  it('extracts text from multi-row table', () => {
    const block: FlatBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [100],
        rows: [
          { cells: [[{ type: 'text', text: 'Row 1', styles: {} }]] },
          { cells: [[{ type: 'text', text: 'Row 2', styles: {} }]] },
        ],
      },
    }
    expect(extractPlainText(block)).toBe('Row 1 Row 2')
  })

  it('handles tables with empty cells', () => {
    const block: FlatBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [100, 100],
        rows: [
          {
            cells: [[], [{ type: 'text', text: 'Only', styles: {} }]],
          },
        ],
      },
    }
    expect(extractPlainText(block)).toBe('Only')
  })

  it('returns null for table with no text', () => {
    const block: FlatBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [],
        rows: [],
      },
    }
    expect(extractPlainText(block)).toBeNull()
  })

  it('extracts text from heading block', () => {
    const block: FlatBlockContent = {
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'My Heading', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('My Heading')
  })

  it('extracts text from bulletListItem block', () => {
    const block: FlatBlockContent = {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: 'List item', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('List item')
  })

  it('extracts text from quote block', () => {
    const block: FlatBlockContent = {
      type: 'quote',
      props: {},
      content: [{ type: 'text', text: 'A quote', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('A quote')
  })

  it('extracts text from numberedListItem block', () => {
    const block: FlatBlockContent = {
      type: 'numberedListItem',
      props: {},
      content: [{ type: 'text', text: 'Numbered item', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('Numbered item')
  })

  it('extracts text from codeBlock block', () => {
    const block: FlatBlockContent = {
      type: 'codeBlock',
      props: {},
      content: [{ type: 'text', text: 'const x = 1', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('const x = 1')
  })

  it('extracts text from checkListItem block', () => {
    const block: FlatBlockContent = {
      type: 'checkListItem',
      props: {},
      content: [{ type: 'text', text: 'Todo item', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('Todo item')
  })

  it('returns empty string for text node with empty string', () => {
    const block: FlatBlockContent = {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: '', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('')
  })

  it('returns null for empty heading content', () => {
    const block: FlatBlockContent = {
      type: 'heading',
      props: { level: 2 },
      content: [],
    }
    expect(extractPlainText(block)).toBeNull()
  })

  it('space-separates text with mixed styles', () => {
    const block: FlatBlockContent = {
      type: 'paragraph',
      props: {},
      content: [
        { type: 'text', text: 'Hello', styles: {} },
        { type: 'text', text: 'link', styles: { underline: true } },
        { type: 'text', text: 'end', styles: { bold: true } },
      ],
    }
    expect(extractPlainText(block)).toBe('Hello link end')
  })
})
