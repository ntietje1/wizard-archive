import { describe, expect, it } from 'vitest'
import { customBlockSpecs } from '../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { flatBlockContentSchema } from '../../../shared/editor-blocks/blockSchemas'

describe('flat block type coverage', () => {
  const editorBlockTypes = Object.keys(customBlockSpecs)

  it('accepts every block type from the editor schema', () => {
    const minimalProps: Record<string, Record<string, unknown>> = {
      heading: { level: 1 },
    }
    for (const blockType of editorBlockTypes) {
      const block: Record<string, unknown> = {
        type: blockType,
        props: minimalProps[blockType] ?? {},
      }
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
        rows: [
          { cells: [{ type: 'tableCell', content: [{ type: 'text', text: 'A', styles: {} }] }] },
        ],
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

  it('accepts an embed block with all props', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/img.png',
        name: 'img.png',
        previewWidth: 300,
        textAlignment: 'center',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects legacy media blocks after migration', () => {
    for (const type of ['image', 'video', 'audio', 'file']) {
      const result = flatBlockContentSchema.safeParse({
        type,
        props: { url: 'https://example.com/item' },
      })
      expect(result.success, `expected ${type} to be rejected`).toBe(false)
    }
  })

  it('rejects embeds missing their target-specific locator', () => {
    expect(
      flatBlockContentSchema.safeParse({
        type: 'embed',
        props: { targetKind: 'externalUrl' },
      }).success,
    ).toBe(false)

    expect(
      flatBlockContentSchema.safeParse({
        type: 'embed',
        props: { targetKind: 'sidebarItem' },
      }).success,
    ).toBe(false)
  })

  it('accepts a paragraph with inline value content', () => {
    const result = flatBlockContentSchema.safeParse({
      type: 'paragraph',
      props: {},
      content: [
        {
          type: 'value',
          props: {
            valueId: 'value-1',
            slug: 'strength_mod',
            expressionSource: 'floor(([[strength]] - 10) / 2)',
          },
        },
      ],
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
