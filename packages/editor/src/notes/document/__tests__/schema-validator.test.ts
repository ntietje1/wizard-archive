import { describe, expect, it } from 'vite-plus/test'
import { CANVAS_TEXT_BLOCK_TYPES } from '../../../canvas/text/model'
import { NOTE_VALUE_PROP_DEFAULTS } from '../../values/schema'
import { testNoteBlockId } from '../../../test/blocknote-id'
import { migrateLegacyMediaBlocks, noteBlockSchema } from '../model'
import { customBlockSpecs } from '../schema-factory'

describe('block type coverage', () => {
  const editorBlockTypes = Object.keys(customBlockSpecs)

  it('validator accepts every block type from the editor schema', () => {
    for (const blockType of editorBlockTypes) {
      const block: Record<string, unknown> = {
        id: testNoteBlockId('test'),
        type: blockType,
        props: {},
      }
      // heading requires level prop
      if (blockType === 'heading') block.props = { level: 1 }
      const result = noteBlockSchema.safeParse(block)
      expect(result.success, `Validator should accept block type "${blockType}"`).toBe(true)
    }
  })

  it('validator rejects block types not in the editor schema', () => {
    const fakeTypes = ['type1', 'type2', 'type3', 'type4']
    for (const fakeType of fakeTypes) {
      const result = noteBlockSchema.safeParse({
        id: testNoteBlockId('test'),
        type: fakeType,
        props: {},
      })
      expect(result.success, `Validator should reject unknown type "${fakeType}"`).toBe(false)
    }
  })
})

describe('valid blocks are accepted', () => {
  it('accepts a minimal paragraph', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('test-1'),
      type: 'paragraph',
      props: {},
      content: [],
      children: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a paragraph with styled text', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('test-2'),
      type: 'paragraph',
      props: { textColor: 'red', textAlignment: 'center' },
      content: [
        { type: 'text', text: 'Hello', styles: { bold: true, italic: true } },
        { type: 'text', text: ' world', styles: {} },
      ],
      children: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a heading with all props', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('h-1'),
      type: 'heading',
      props: { level: 3, isToggleable: true, textColor: 'blue' },
      content: [{ type: 'text', text: 'Title', styles: {} }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a checkListItem', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('cl-1'),
      type: 'checkListItem',
      props: { checked: true },
      content: [{ type: 'text', text: 'Done', styles: {} }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a divider with no content', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('d-1'),
      type: 'divider',
      props: {},
    })
    expect(result.success).toBe(true)
  })

  it('accepts an embed block', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('embed-1'),
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

  it('accepts an empty embed block without stale target props', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('embed-empty'),
      type: 'embed',
      props: {},
    })
    expect(result.success).toBe(true)
  })

  it('preserves valid embed preview height during legacy normalization', () => {
    const [block] = migrateLegacyMediaBlocks([
      {
        id: testNoteBlockId('embed-sized'),
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/img.png',
          previewWidth: 320,
          previewHeight: 180,
        },
      },
    ])

    expect(block?.props).toMatchObject({
      targetKind: 'externalUrl',
      url: 'https://example.com/img.png',
      previewWidth: 320,
      previewHeight: 180,
    })
  })

  it('removes stale content from legacy media blocks converted to embeds', () => {
    const [block] = migrateLegacyMediaBlocks([
      {
        id: testNoteBlockId('legacy-image'),
        type: 'image',
        props: { url: 'https://example.com/img.png' },
        content: [{ type: 'text', text: 'stale caption', styles: {} }],
      },
    ])

    expect(block).toEqual(
      expect.objectContaining({
        type: 'embed',
        props: expect.objectContaining({
          targetKind: 'externalUrl',
          url: 'https://example.com/img.png',
        }),
      }),
    )
    expect(block).not.toHaveProperty('content')
  })

  it('accepts a table block with content', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('t-1'),
      type: 'table',
      props: { textColor: 'default' },
      content: {
        type: 'tableContent',
        columnWidths: [100, null, 200],
        rows: [
          {
            cells: [
              { type: 'tableCell', content: [{ type: 'text', text: 'A', styles: {} }] },
              { type: 'tableCell', content: [{ type: 'text', text: 'B', styles: {} }] },
            ],
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts inline value content in a paragraph', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('value-1'),
      type: 'paragraph',
      props: {},
      content: [
        {
          type: 'value',
          props: {
            valueId: 'value-1',
            slug: 'attack_bonus',
            expressionSource: '[[strength_mod]] + [[prof_bonus]]',
          },
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts note value inline props from the shared defaults', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('value-defaults'),
      type: 'paragraph',
      props: {},
      content: [{ type: 'value', props: NOTE_VALUE_PROP_DEFAULTS }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts nested children', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('p-1'),
      type: 'paragraph',
      props: {},
      content: [],
      children: [
        {
          id: testNoteBlockId('p-2'),
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'Nested', styles: {} }],
          children: [],
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('invalid blocks are rejected', () => {
  it('rejects a block with no id', () => {
    const result = noteBlockSchema.safeParse({
      type: 'paragraph',
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty block id', () => {
    const result = noteBlockSchema.safeParse({
      id: '',
      type: 'paragraph',
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a block with no type', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('x'),
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown block type', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('x'),
      type: 'unknownWidget',
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects legacy media blocks after migration', () => {
    for (const type of ['image', 'video', 'audio', 'file']) {
      const result = noteBlockSchema.safeParse({
        id: testNoteBlockId(`${type}-legacy`),
        type,
        props: { url: 'https://example.com/item' },
      })
      expect(result.success, `expected ${type} to be rejected`).toBe(false)
    }
  })

  it('rejects embeds missing their target-specific locator', () => {
    expect(
      noteBlockSchema.safeParse({
        id: testNoteBlockId('embed-missing-url'),
        type: 'embed',
        props: { targetKind: 'externalUrl' },
      }).success,
    ).toBe(false)

    expect(
      noteBlockSchema.safeParse({
        id: testNoteBlockId('embed-missing-resource-id'),
        type: 'embed',
        props: { targetKind: 'resource' },
      }).success,
    ).toBe(false)
  })

  it('rejects empty embeds that retain stale target locators', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('embed-stale'),
      type: 'embed',
      props: {
        targetKind: 'empty',
        url: 'https://example.com/stale.png',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects insecure external embed URLs', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('embed-http'),
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'http://example.com/file.pdf',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a heading with invalid level', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('h'),
      type: 'heading',
      props: { level: 99 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid textAlignment', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('p'),
      type: 'paragraph',
      props: { textAlignment: 'middle' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects inline content with wrong type', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('p'),
      type: 'paragraph',
      props: {},
      content: [{ type: 'link', href: 'http://example.com', content: [] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a style with wrong value type', () => {
    const result = noteBlockSchema.safeParse({
      id: testNoteBlockId('p'),
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'x', styles: { bold: 'yes' } }],
    })
    expect(result.success).toBe(false)
  })
})

describe('canvas block subset', () => {
  it('stays aligned with the note editor block family for supported types', () => {
    const supportedCanvasTypes = Object.keys(customBlockSpecs).filter((type) =>
      CANVAS_TEXT_BLOCK_TYPES.includes(type as (typeof CANVAS_TEXT_BLOCK_TYPES)[number]),
    )

    expect(supportedCanvasTypes.sort((a, b) => a.localeCompare(b))).toEqual(
      [...CANVAS_TEXT_BLOCK_TYPES].sort((a, b) => a.localeCompare(b)),
    )
  })
})
