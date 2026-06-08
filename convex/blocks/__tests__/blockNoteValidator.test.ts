import { describe, expect, it } from 'vitest'
import { blockNoteBlockSchema } from '../../../shared/editor-blocks/blockSchemas'
import { CANVAS_BLOCK_TYPES } from '../../../shared/editor-blocks/blockRegistry'
import { customBlockSpecs } from '../../../shared/editor-blocks/editor-blocknote-spec-factory'
import { NOTE_VALUE_PROP_DEFAULTS } from '../../../shared/note-values/schema'
import { testBlockNoteId } from '../../_test/factories.helper'

// ---------------------------------------------------------------------------
// These tests ensure the Zod validator stays in sync with the BlockNote editor
// schema defined in editorSpecs.ts. If either side changes (e.g. a new block
// type is added to BlockNote, or a prop is renamed), these tests will fail.
// ---------------------------------------------------------------------------

// --- Block type coverage ---------------------------------------------------

describe('block type coverage', () => {
  // Probe the validator by attempting to parse each block type from the editor
  // schema with minimal valid data. This avoids depending on Zod internals.
  const editorBlockTypes = Object.keys(customBlockSpecs)

  it('validator accepts every block type from the editor schema', () => {
    for (const blockType of editorBlockTypes) {
      const block: Record<string, unknown> = {
        id: testBlockNoteId('test'),
        type: blockType,
        props: {},
      }
      // heading requires level prop
      if (blockType === 'heading') block.props = { level: 1 }
      const result = blockNoteBlockSchema.safeParse(block)
      expect(result.success, `Validator should accept block type "${blockType}"`).toBe(true)
    }
  })

  it('validator rejects block types not in the editor schema', () => {
    const fakeTypes = ['type1', 'type2', 'type3', 'type4']
    for (const fakeType of fakeTypes) {
      const result = blockNoteBlockSchema.safeParse({
        id: testBlockNoteId('test'),
        type: fakeType,
        props: {},
      })
      expect(result.success, `Validator should reject unknown type "${fakeType}"`).toBe(false)
    }
  })
})

// --- Valid block acceptance -------------------------------------------------

describe('valid blocks are accepted', () => {
  it('accepts a minimal paragraph', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('test-1'),
      type: 'paragraph',
      props: {},
      content: [],
      children: [],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a paragraph with styled text', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('test-2'),
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
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('h-1'),
      type: 'heading',
      props: { level: 3, isToggleable: true, textColor: 'blue' },
      content: [{ type: 'text', text: 'Title', styles: {} }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a checkListItem', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('cl-1'),
      type: 'checkListItem',
      props: { checked: true },
      content: [{ type: 'text', text: 'Done', styles: {} }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a divider with no content', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('d-1'),
      type: 'divider',
      props: {},
    })
    expect(result.success).toBe(true)
  })

  it('accepts an embed block', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('embed-1'),
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
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('embed-empty'),
      type: 'embed',
      props: {},
    })
    expect(result.success).toBe(true)
  })

  it('accepts a table block with content', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('t-1'),
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
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('value-1'),
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
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('value-defaults'),
      type: 'paragraph',
      props: {},
      content: [{ type: 'value', props: NOTE_VALUE_PROP_DEFAULTS }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts nested children', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('p-1'),
      type: 'paragraph',
      props: {},
      content: [],
      children: [
        {
          id: testBlockNoteId('p-2'),
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

// --- Invalid block rejection -----------------------------------------------

describe('invalid blocks are rejected', () => {
  it('rejects a block with no id', () => {
    const result = blockNoteBlockSchema.safeParse({
      type: 'paragraph',
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty block id', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: '',
      type: 'paragraph',
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a block with no type', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('x'),
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown block type', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('x'),
      type: 'unknownWidget',
      props: {},
      content: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects legacy media blocks after migration', () => {
    for (const type of ['image', 'video', 'audio', 'file']) {
      const result = blockNoteBlockSchema.safeParse({
        id: testBlockNoteId(`${type}-legacy`),
        type,
        props: { url: 'https://example.com/item' },
      })
      expect(result.success, `expected ${type} to be rejected`).toBe(false)
    }
  })

  it('rejects embeds missing their target-specific locator', () => {
    expect(
      blockNoteBlockSchema.safeParse({
        id: testBlockNoteId('embed-missing-url'),
        type: 'embed',
        props: { targetKind: 'externalUrl' },
      }).success,
    ).toBe(false)

    expect(
      blockNoteBlockSchema.safeParse({
        id: testBlockNoteId('embed-missing-sidebar-id'),
        type: 'embed',
        props: { targetKind: 'sidebarItem' },
      }).success,
    ).toBe(false)
  })

  it('rejects empty embeds that retain stale target locators', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('embed-stale'),
      type: 'embed',
      props: {
        targetKind: 'empty',
        url: 'https://example.com/stale.png',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects insecure external embed URLs', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('embed-http'),
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
        url: 'http://example.com/file.pdf',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a heading with invalid level', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('h'),
      type: 'heading',
      props: { level: 99 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid textAlignment', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('p'),
      type: 'paragraph',
      props: { textAlignment: 'middle' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects inline content with wrong type', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('p'),
      type: 'paragraph',
      props: {},
      content: [{ type: 'link', href: 'http://example.com', content: [] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a style with wrong value type', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('p'),
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
      CANVAS_BLOCK_TYPES.includes(type as (typeof CANVAS_BLOCK_TYPES)[number]),
    )

    expect(supportedCanvasTypes.sort()).toEqual([...CANVAS_BLOCK_TYPES].sort())
  })
})
