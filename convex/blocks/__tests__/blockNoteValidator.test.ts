import { describe, expect, it } from 'vitest'
import { blockNoteBlockSchema } from '../blockSchemas'
import {
  customBlockSpecs,
  customInlineContentSpecs,
  customStyleSpecs,
} from '../../notes/editorSpecs'
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

// --- Inline content coverage -----------------------------------------------

describe('inline content coverage', () => {
  it('text is the only inline content type (link removed)', () => {
    expect(Object.keys(customInlineContentSpecs)).toEqual(['text'])
  })
})

// --- Style coverage --------------------------------------------------------

describe('style coverage', () => {
  const expectedStyles = [
    'bold',
    'italic',
    'underline',
    'strike',
    'code',
    'textColor',
    'backgroundColor',
  ]

  it('editor schema has the expected styles', () => {
    expect(Object.keys(customStyleSpecs).sort()).toEqual(expectedStyles.sort())
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

  it('accepts an image block', () => {
    const result = blockNoteBlockSchema.safeParse({
      id: testBlockNoteId('img-1'),
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
              [{ type: 'text', text: 'A', styles: {} }],
              [{ type: 'text', text: 'B', styles: {} }],
            ],
          },
        ],
      },
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
