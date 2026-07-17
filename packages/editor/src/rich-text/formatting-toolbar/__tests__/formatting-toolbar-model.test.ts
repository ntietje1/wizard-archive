import { describe, expect, it } from 'vite-plus/test'
import { getVisibleToolbarSnapshot, toolbarSnapshotsEqual } from '../formatting-toolbar-model'
import {
  createFormattingToolbarTestEditor as createEditor,
  createHeadingBlock,
  createParagraphBlock,
} from './formatting-toolbar-test-utils'

describe('getVisibleToolbarSnapshot', () => {
  it('reports uniform alignment and block type only when selected blocks agree', () => {
    const uniformEditor = createEditor({
      selectedBlocks: [
        createParagraphBlock('paragraph-1', { textAlignment: 'center' }),
        createParagraphBlock('paragraph-2', { textAlignment: 'center' }),
      ],
    })
    const mixedEditor = createEditor({
      selectedBlocks: [
        createParagraphBlock('paragraph-1', { textAlignment: 'left' }),
        createParagraphBlock('paragraph-2', { textAlignment: 'right' }),
      ],
    })

    expect(snapshotFor(uniformEditor)).toMatchObject({
      activeAlignment: 'center',
      activeBlockTypeId: 'paragraph',
      canAlign: true,
    })
    expect(snapshotFor(mixedEditor)).toMatchObject({
      activeAlignment: null,
      activeBlockTypeId: 'paragraph',
      canAlign: true,
    })
  })

  it('ignores non-text blocks when resolving the selected block type', () => {
    const editor = createEditor({
      selectedBlocks: [
        createParagraphBlock('paragraph-1', { textAlignment: 'left' }),
        { id: 'embed-1', type: 'embed', props: { url: 'https://example.com' } },
      ],
    })

    expect(snapshotFor(editor).activeBlockTypeId).toBe('paragraph')
  })

  it('matches block type options by exact props and mode support', () => {
    const headingEditor = createEditor({
      selectedBlocks: [createHeadingBlock('heading-1', 1, 'left')],
    })
    const toggleHeadingEditor = createEditor({
      selectedBlocks: [
        {
          ...createHeadingBlock('toggle-heading-1', 1, 'left'),
          props: { isToggleable: true, level: 1, textAlignment: 'left' },
        },
      ],
    })

    expect(snapshotFor(headingEditor).activeBlockTypeId).toBe('heading-1')
    expect(snapshotFor(toggleHeadingEditor).activeBlockTypeId).toBe('toggle-heading-1')
    expect(snapshotFor(toggleHeadingEditor, 'compact').activeBlockTypeId).toBeNull()
  })

  it('omits unsupported block options when their schema props are missing', () => {
    const editor = createEditor({
      selectedBlocks: [createHeadingBlock('heading-1', 1, 'left')],
    })
    delete (editor.schema.blockSchema.heading.propSchema as Record<string, unknown>).level

    const snapshot = snapshotFor(editor)

    expect(snapshot.supportedBlockTypes.map((option) => option.id)).not.toContain('heading-1')
    expect(snapshot.activeBlockTypeId).toBeNull()
  })

  it('reads active styles once while building the snapshot', () => {
    const editor = createEditor({
      activeStyles: { backgroundColor: 'var(--bg-red)', bold: true, textColor: 'var(--t-red)' },
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    expect(snapshotFor(editor)).toMatchObject({
      activeBackgroundColor: 'var(--bg-red)',
      activeStyles: { bold: true },
    })
    expect(editor.getActiveStyles).toHaveBeenCalledTimes(1)
  })

  it('reads the current selection once while building the snapshot', () => {
    const editor = createEditor({
      selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
    })

    expect(snapshotFor(editor)).toMatchObject({
      activeBlockTypeId: 'paragraph',
      hasTextSelection: true,
    })
    expect(editor.getSelection).toHaveBeenCalledTimes(1)
  })
})

describe('toolbarSnapshotsEqual', () => {
  it('compares rich text color values and supported block option ids', () => {
    const snapshot = snapshotFor(
      createEditor({
        activeStyles: { textColor: 'var(--t-red)' },
        selectedBlocks: [createParagraphBlock('paragraph-1', { textAlignment: 'left' })],
      }),
    )

    expect(toolbarSnapshotsEqual(snapshot, snapshot)).toBe(true)
    expect(
      toolbarSnapshotsEqual(snapshot, {
        ...snapshot,
        activeTextColor: { kind: 'value', value: { color: 'var(--t-blue)', opacity: 100 } },
      }),
    ).toBe(false)
    expect(
      toolbarSnapshotsEqual(snapshot, {
        ...snapshot,
        supportedBlockTypes: snapshot.supportedBlockTypes.slice(1),
      }),
    ).toBe(false)
  })
})

function snapshotFor(editor: ReturnType<typeof createEditor>, mode: 'compact' | 'full' = 'full') {
  return getVisibleToolbarSnapshot({
    defaultTextColor: 'var(--t-default)',
    editor: editor as never,
    mode,
    visible: true,
  })
}
