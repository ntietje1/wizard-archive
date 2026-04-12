import { describe, expect, it } from 'vitest'
import { flatBlockContentSchema } from '../flatBlockValidator'
import { customBlockSpecs } from '../../notes/editorSpecs'

describe('flat block type coverage', () => {
  const editorBlockTypes = Object.keys(customBlockSpecs)

  it('accepts every block type from the editor schema', () => {
    for (const blockType of editorBlockTypes) {
      const block: Record<string, unknown> = { type: blockType, props: {} }
      if (blockType === 'heading') block.props = { level: 1 }
      const result = flatBlockContentSchema.safeParse(block)
      expect(result.success, `Validator should accept block type "${blockType}"`).toBe(true)
    }
  })

  it('rejects block types not in the editor schema', () => {
    const realTypes = new Set(Object.keys(customBlockSpecs))
    const fakeTypes = ['__invalid_type_1__', '__invalid_type_2__', '__invalid_type_3__']
    for (const fakeType of fakeTypes) {
      expect(realTypes.has(fakeType)).toBe(false)
      const result = flatBlockContentSchema.safeParse({ type: fakeType, props: {} })
      expect(result.success, `Validator should reject unknown type "${fakeType}"`).toBe(false)
    }
  })
})

describe('flat blocks have no id or children', () => {
  it('rejects blocks with an id field', () => {
    const result = flatBlockContentSchema.safeParse({
      id: 'test',
      type: 'paragraph',
      props: {},
    })
    expect(result.success).toBe(false)
  })

  it('rejects blocks with a children field', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'paragraph',
      props: {},
      children: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('flat block content validation', () => {
  it('accepts a paragraph with inline content', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'paragraph',
      props: { textColor: 'red' },
      content: [{ type: 'text', text: 'Hello', styles: { bold: true } }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a table block with table content', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'table',
      props: { textColor: 'default' },
      content: {
        type: 'tableContent',
        columnWidths: [100, null],
        rows: [{ cells: [[{ type: 'text', text: 'A', styles: {} }]] }],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a divider with no content', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'divider',
      props: {},
    })
    expect(result.success).toBe(true)
  })

  it('accepts an image block with all props', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'image',
      props: {
        url: 'https://example.com/img.png',
        name: 'img.png',
        caption: 'A photo',
        showPreview: true,
        previewWidth: 300,
        textAlignment: 'center',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a heading with invalid level', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'heading',
      props: { level: 99 },
    })
    expect(result.success).toBe(false)
  })
})
