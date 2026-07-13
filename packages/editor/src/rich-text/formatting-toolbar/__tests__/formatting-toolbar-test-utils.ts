import { Schema } from '@tiptap/pm/model'
import { vi } from 'vite-plus/test'

type TestBlock = {
  children?: Array<TestBlock>
  content?: Array<unknown>
  id: string
  props: Record<string, unknown>
  type: string
}

const proseMirrorTestSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'text*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  },
})

export function createFormattingToolbarTestEditor({
  activeStyles = {},
  hasTextSelection = true,
  selectionSnapshot = null,
  selectedCutBlocks,
  selectedBlocks,
}: {
  activeStyles?: Record<string, unknown>
  hasTextSelection?: boolean
  selectionSnapshot?: Record<string, unknown> | null
  selectedCutBlocks?: Array<TestBlock>
  selectedBlocks: Array<TestBlock>
}) {
  let currentActiveStyles = activeStyles
  let currentSelectedBlocks = selectedBlocks
  let currentSelectedCutBlocks = selectedCutBlocks ?? selectedBlocks
  let currentSelectionSnapshot = selectionSnapshot
  const selectionListeners = new Set<() => void>()
  const changeListeners = new Set<() => void>()
  const focus = vi.fn()
  const transaction = {
    setSelection: vi.fn((_selection: unknown) => transaction),
  }
  const prosemirrorView = {
    dispatch: vi.fn(),
    dom: document.createElement('div'),
    focus,
    state: {
      doc: proseMirrorTestSchema.node('doc', null, [
        proseMirrorTestSchema.node('paragraph', null, [proseMirrorTestSchema.text('hello')]),
      ]),
      selection: {
        from: 1,
        to: 6,
        toJSON: vi.fn(() => currentSelectionSnapshot),
      },
      tr: transaction,
    },
  }

  return {
    _tiptapEditor: {
      view: prosemirrorView,
    },
    addStyles: vi.fn(),
    get document() {
      return currentSelectedBlocks
    },
    focus,
    getActiveStyles: vi.fn(() => currentActiveStyles),
    getSelection: vi.fn(() => (hasTextSelection ? { blocks: currentSelectedBlocks } : undefined)),
    getSelectionCutBlocks: vi.fn(() => ({
      _meta: { endPos: 0, startPos: 0 },
      blockCutAtEnd: undefined,
      blockCutAtStart: undefined,
      blocks: currentSelectedCutBlocks,
    })),
    getTextCursorPosition: vi.fn(() => ({
      block: currentSelectedBlocks[0],
      nextBlock: undefined,
      parentBlock: undefined,
      prevBlock: undefined,
    })),
    isEditable: true,
    onChange: vi.fn((callback: () => void) => {
      changeListeners.add(callback)
      return () => changeListeners.delete(callback)
    }),
    onSelectionChange: vi.fn((callback: () => void) => {
      selectionListeners.add(callback)
      return () => selectionListeners.delete(callback)
    }),
    prosemirrorView,
    removeStyles: vi.fn(),
    replaceBlocks: vi.fn(),
    schema: {
      blockSchema: {
        bulletListItem: {
          propSchema: { backgroundColor: {}, textAlignment: {}, textColor: {} },
        },
        checkListItem: {
          propSchema: { backgroundColor: {}, checked: {}, textAlignment: {}, textColor: {} },
        },
        codeBlock: { propSchema: { language: {} } },
        embed: { propSchema: { name: {}, targetKind: {}, url: {} } },
        heading: {
          propSchema: {
            backgroundColor: {},
            isToggleable: {},
            level: {},
            textAlignment: {},
            textColor: {},
          },
        },
        numberedListItem: {
          propSchema: { backgroundColor: {}, start: {}, textAlignment: {}, textColor: {} },
        },
        paragraph: {
          propSchema: { backgroundColor: {}, textAlignment: {}, textColor: {} },
        },
        quote: { propSchema: { backgroundColor: {}, textColor: {} } },
        toggleListItem: { propSchema: {} },
      },
      inlineContentSchema: {
        link: 'link',
      },
      styleSchema: {
        backgroundColor: { propSchema: 'string', type: 'backgroundColor' },
        bold: { propSchema: 'boolean', type: 'bold' },
        italic: { propSchema: 'boolean', type: 'italic' },
        strike: { propSchema: 'boolean', type: 'strike' },
        textColor: { propSchema: 'string', type: 'textColor' },
        underline: { propSchema: 'boolean', type: 'underline' },
      },
    },
    setActiveStyles(nextActiveStyles: Record<string, unknown>) {
      currentActiveStyles = nextActiveStyles
      changeListeners.forEach((listener) => listener())
    },
    setSelection(nextSelectedBlocks: Array<TestBlock>) {
      currentSelectedBlocks = nextSelectedBlocks
      currentSelectedCutBlocks = nextSelectedBlocks
      selectionListeners.forEach((listener) => listener())
    },
    setSelectionSnapshot(nextSelectionSnapshot: Record<string, unknown> | null) {
      currentSelectionSnapshot = nextSelectionSnapshot
    },
    emitSelectionChange() {
      selectionListeners.forEach((listener) => listener())
    },
    toggleStyles: vi.fn(),
    transact: vi.fn((callback: () => void) => callback()),
    updateBlock: vi.fn(),
  }
}

export function createParagraphBlock(
  id: string,
  props: Record<string, unknown> & { content?: Array<unknown> },
): TestBlock {
  const { content, ...blockProps } = props
  return {
    id,
    type: 'paragraph',
    props: blockProps,
    content: content ?? [{ text: 'hello' }],
  }
}

export function createHeadingBlock(id: string, level: number, textAlignment: string): TestBlock {
  return {
    id,
    type: 'heading',
    props: {
      level,
      isToggleable: false,
      textAlignment,
    },
    content: [{ text: 'heading' }],
  }
}
