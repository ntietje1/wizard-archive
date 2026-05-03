import { describe, expect, it } from 'vitest'
import { customStyleSpecs } from 'convex/notes/editorSpecs'
import {
  canvasRichTextEditorSchema,
  createEmptyCanvasRichTextContent,
  readCanvasRichTextContentState,
} from '../canvas-rich-text-editor'

describe('canvas rich text schema', () => {
  it('renders arbitrary text colors in the editable BlockNote DOM', () => {
    const rendered = customStyleSpecs.textColor.implementation.render(
      '#123456',
      canvasRichTextEditorSchema as never,
    )

    expect(rendered.dom).toHaveStyle({ color: '#123456' })
  })
})

describe('readCanvasRichTextContentState', () => {
  it('treats missing or empty content as valid empty canvas content', () => {
    expect(readCanvasRichTextContentState(undefined)).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'valid',
    })
    expect(readCanvasRichTextContentState([])).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'valid',
    })
  })

  it('accepts canvas-supported rich-text blocks', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
        },
      ]),
    ).toEqual({
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
        },
      ],
      kind: 'valid',
    })
  })

  it('accepts multiple canvas-supported blocks', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'World', styles: { italic: true } }],
        },
      ]),
    ).toEqual({
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'World', styles: { italic: true } }],
        },
      ],
      kind: 'valid',
    })
  })

  it('accepts all canvas-supported block types', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
        {
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Bullet' }],
        },
        {
          type: 'numberedListItem',
          content: [{ type: 'text', text: 'Numbered' }],
        },
        {
          type: 'checkListItem',
          props: { checked: true },
          content: [{ type: 'text', text: 'Checked' }],
        },
        {
          type: 'codeBlock',
          props: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = 1' }],
        },
      ]),
    ).toEqual({
      content: [
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
        {
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Bullet' }],
        },
        {
          type: 'numberedListItem',
          content: [{ type: 'text', text: 'Numbered' }],
        },
        {
          type: 'checkListItem',
          props: { checked: true },
          content: [{ type: 'text', text: 'Checked' }],
        },
        {
          type: 'codeBlock',
          props: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = 1' }],
        },
      ],
      kind: 'valid',
    })
  })

  it('accepts empty content arrays and multi-style text nodes', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'Styled', styles: { bold: true, italic: true } }],
        },
      ]),
    ).toEqual({
      content: [
        {
          type: 'paragraph',
          content: [],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'Styled', styles: { bold: true, italic: true } }],
        },
      ],
      kind: 'valid',
    })
  })

  it('marks malformed or excluded note blocks as invalid', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'table',
          props: { textColor: 'default' },
          content: {
            type: 'tableContent',
            columnWidths: [100],
            rows: [{ cells: [[{ type: 'text', text: 'Nope' }]] }],
          },
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })
  })

  it('marks mixed valid and invalid blocks as invalid', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
        {
          type: 'table',
          props: { textColor: 'default' },
          content: {
            type: 'tableContent',
            columnWidths: [100],
            rows: [{ cells: [[{ type: 'text', text: 'Nope' }]] }],
          },
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })
  })

  it('marks malformed text nodes and invalid style values as invalid', () => {
    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [{ text: 'Missing type' }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })

    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', styles: { bold: true } }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })

    expect(
      readCanvasRichTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: 'yes' } }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })
  })

  it('marks missing or null required block fields as invalid', () => {
    expect(readCanvasRichTextContentState([null])).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })

    expect(
      readCanvasRichTextContentState([
        {
          content: [{ type: 'text', text: 'Missing type' }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasRichTextContent(),
      kind: 'invalid',
    })
  })
})
