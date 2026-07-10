import { describe, expect, it } from 'vitest'
import { extractPlainText } from '../functions/extractPlainText'
import type { NoteBlockContent } from '@wizard-archive/editor/notes/document-contract'

describe('extractPlainText', () => {
  it('returns empty string for blocks with no content', () => {
    const block: NoteBlockContent = { type: 'divider', props: {} }
    expect(extractPlainText(block)).toBe('')
  })

  it('returns empty string for blocks with empty content array', () => {
    const block: NoteBlockContent = { type: 'paragraph', props: {}, content: [] }
    expect(extractPlainText(block)).toBe('')
  })

  it('space-separates text from inline content', () => {
    const block: NoteBlockContent = {
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
    const block: NoteBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [100, 100],
        rows: [
          {
            cells: [
              { type: 'tableCell', content: [{ type: 'text', text: 'Cell 1', styles: {} }] },
              { type: 'tableCell', content: [{ type: 'text', text: 'Cell 2', styles: {} }] },
            ],
          },
        ],
      },
    }
    expect(extractPlainText(block)).toBe('Cell 1 Cell 2')
  })

  it('extracts text from multi-row table', () => {
    const block: NoteBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [100],
        rows: [
          {
            cells: [{ type: 'tableCell', content: [{ type: 'text', text: 'Row 1', styles: {} }] }],
          },
          {
            cells: [{ type: 'tableCell', content: [{ type: 'text', text: 'Row 2', styles: {} }] }],
          },
        ],
      },
    }
    expect(extractPlainText(block)).toBe('Row 1 Row 2')
  })

  it('handles tables with empty cells', () => {
    const block: NoteBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [100, 100],
        rows: [
          {
            cells: [
              { type: 'tableCell', content: [] },
              { type: 'tableCell', content: [{ type: 'text', text: 'Only', styles: {} }] },
            ],
          },
        ],
      },
    }
    expect(extractPlainText(block)).toBe('Only')
  })

  it('returns empty string for table with no text', () => {
    const block: NoteBlockContent = {
      type: 'table',
      props: {},
      content: {
        type: 'tableContent',
        columnWidths: [],
        rows: [],
      },
    }
    expect(extractPlainText(block)).toBe('')
  })

  it('extracts text from heading block', () => {
    const block: NoteBlockContent = {
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: 'My Heading', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('My Heading')
  })

  it('extracts text from bulletListItem block', () => {
    const block: NoteBlockContent = {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: 'List item', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('List item')
  })

  it('extracts text from quote block', () => {
    const block: NoteBlockContent = {
      type: 'quote',
      props: {},
      content: [{ type: 'text', text: 'A quote', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('A quote')
  })

  it('extracts text from numberedListItem block', () => {
    const block: NoteBlockContent = {
      type: 'numberedListItem',
      props: {},
      content: [{ type: 'text', text: 'Numbered item', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('Numbered item')
  })

  it('extracts text from codeBlock block', () => {
    const block: NoteBlockContent = {
      type: 'codeBlock',
      props: {},
      content: [{ type: 'text', text: 'const x = 1', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('const x = 1')
  })

  it('extracts text from checkListItem block', () => {
    const block: NoteBlockContent = {
      type: 'checkListItem',
      props: {},
      content: [{ type: 'text', text: 'Todo item', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('Todo item')
  })

  it('returns empty string for text node with empty string', () => {
    const block: NoteBlockContent = {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: '', styles: {} }],
    }
    expect(extractPlainText(block)).toBe('')
  })

  it('returns empty string for empty heading content', () => {
    const block: NoteBlockContent = {
      type: 'heading',
      props: { level: 2 },
      content: [],
    }
    expect(extractPlainText(block)).toBe('')
  })

  it('space-separates text with mixed styles', () => {
    const block: NoteBlockContent = {
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
