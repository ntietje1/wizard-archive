import { describe, expect, it } from 'vite-plus/test'
import { parseCanvasTextDocument } from '../model'

describe('canvas text document model', () => {
  it('parses canvas-owned text blocks for persisted text node content', () => {
    expect(
      parseCanvasTextDocument([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
        },
        {
          type: 'quote',
          props: { textAlignment: 'center' },
          content: [{ type: 'text', text: 'World' }],
        },
      ]),
    ).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
      },
      {
        type: 'quote',
        props: { textAlignment: 'center' },
        content: [{ type: 'text', text: 'World' }],
      },
    ])
  })

  it('keeps note-only block shapes out of canvas text node content', () => {
    expect(
      parseCanvasTextDocument([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Canvas text' }],
        },
        {
          type: 'table',
          props: { textColor: 'default' },
          content: {
            type: 'tableContent',
            columnWidths: [100],
            rows: [{ cells: [[{ type: 'text', text: 'Note table' }]] }],
          },
        },
      ]),
    ).toBeNull()
  })
})
