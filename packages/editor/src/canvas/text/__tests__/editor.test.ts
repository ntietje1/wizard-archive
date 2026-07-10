import { describe, expect, it, vi } from 'vite-plus/test'
import { applyCanvasTextDefaultTextColor } from '../default-color'
import { normalizeCanvasTextNodeRenderData } from '../node-data'
import {
  createEmptyCanvasTextContent,
  extractCanvasTextPlainText,
  readCanvasTextContentState,
} from '../editor'
import { canvasTextEditorSchema } from '../schema'

describe('canvas text schema', () => {
  it('includes text color in the canvas-owned BlockNote schema subset', () => {
    expect(canvasTextEditorSchema.styleSchema.textColor).toBeDefined()
  })
})

describe('readCanvasTextContentState', () => {
  it('treats missing or empty content as valid empty canvas content', () => {
    expect(readCanvasTextContentState(undefined)).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'valid',
    })
    expect(readCanvasTextContentState([])).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'valid',
    })
  })

  it('accepts canvas-supported rich-text blocks', () => {
    expect(
      readCanvasTextContentState([
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
      readCanvasTextContentState([
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
      readCanvasTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Paragraph' }],
        },
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'Quote' }],
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
          type: 'paragraph',
          content: [{ type: 'text', text: 'Paragraph' }],
        },
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Heading' }],
        },
        {
          type: 'quote',
          content: [{ type: 'text', text: 'Quote' }],
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
      readCanvasTextContentState([
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
      readCanvasTextContentState([
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
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })
  })

  it('marks mixed valid and invalid blocks as invalid', () => {
    expect(
      readCanvasTextContentState([
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
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })
  })

  it('marks malformed text nodes and invalid style values as invalid', () => {
    expect(
      readCanvasTextContentState([
        {
          type: 'paragraph',
          content: [{ text: 'Missing type' }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })

    expect(
      readCanvasTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', styles: { bold: true } }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })

    expect(
      readCanvasTextContentState([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello', styles: { bold: 'yes' } }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })
  })

  it('marks missing or null required block fields as invalid', () => {
    expect(readCanvasTextContentState([null])).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })

    expect(
      readCanvasTextContentState([
        {
          content: [{ type: 'text', text: 'Missing type' }],
        },
      ]),
    ).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })
  })
})

describe('extractCanvasTextPlainText', () => {
  it('keeps inline text runs contiguous inside a block and separates blocks', () => {
    const contentState = readCanvasTextContentState([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'he' },
          { type: 'text', text: 'llo' },
        ],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'world' }],
      },
    ])

    expect(contentState.kind).toBe('valid')
    expect(extractCanvasTextPlainText(contentState.content)).toBe('hello world')
  })

  it('reads visible text from nested inline content', () => {
    expect(
      extractCanvasTextPlainText([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'he' },
            {
              type: 'link',
              content: [{ type: 'text', text: 'llo' }],
            },
          ],
        },
      ] as unknown as Parameters<typeof extractCanvasTextPlainText>[0]),
    ).toBe('hello')
  })
})

describe('normalizeCanvasTextNodeRenderData', () => {
  it('revalidates embedded rich-text content before treating node data as normalized', () => {
    expect(
      normalizeCanvasTextNodeRenderData({
        text: {
          kind: 'valid',
          content: [
            {
              type: 'table',
              props: { textColor: 'default' },
              content: {
                type: 'tableContent',
                columnWidths: [100],
                rows: [{ cells: [[{ type: 'text', text: 'Nope' }]] }],
              },
            },
          ],
        },
      } as unknown as Parameters<typeof normalizeCanvasTextNodeRenderData>[0]).text,
    ).toEqual({
      content: createEmptyCanvasTextContent(),
      kind: 'invalid',
    })
  })
})

describe('applyCanvasTextDefaultTextColor', () => {
  it('does not replace blocks when existing text already has a concrete color', () => {
    const replaceBlocks = vi.fn()
    const editor = {
      addStyles: vi.fn(),
      focus: vi.fn(),
      get document() {
        return [
          {
            id: 'block-1',
            props: {},
            type: 'paragraph',
            content: [{ type: 'text', text: 'Already colored', styles: { textColor: '#111111' } }],
          },
        ]
      },
      replaceBlocks,
    } as unknown as Parameters<typeof applyCanvasTextDefaultTextColor>[0]

    applyCanvasTextDefaultTextColor(editor, '#111111', '#222222')

    expect(replaceBlocks).not.toHaveBeenCalled()
    expect(editor.addStyles).toHaveBeenCalledWith({ textColor: '#222222' })
    expect(editor.focus).toHaveBeenCalled()
  })

  it('materializes the previous default color before applying the next default color', () => {
    const document = [
      {
        id: 'block-1',
        props: {},
        type: 'paragraph',
        content: [{ type: 'text', text: 'Needs materialized color', styles: { bold: true } }],
      },
    ]
    const replaceBlocks = vi.fn()
    const editor = {
      addStyles: vi.fn(),
      focus: vi.fn(),
      get document() {
        return document
      },
      replaceBlocks,
    } as unknown as Parameters<typeof applyCanvasTextDefaultTextColor>[0]

    applyCanvasTextDefaultTextColor(editor, '#111111', '#222222')

    expect(replaceBlocks).toHaveBeenCalledWith(document, [
      {
        id: 'block-1',
        props: {},
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Needs materialized color',
            styles: { bold: true, textColor: '#111111' },
          },
        ],
      },
    ])
    expect(editor.addStyles).toHaveBeenCalledWith({ textColor: '#222222' })
    expect(editor.focus).toHaveBeenCalled()
  })
})
