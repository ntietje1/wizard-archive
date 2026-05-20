import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { Sigma } from 'lucide-react'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import {
  NOTE_VALUE_DEFAULT_SLUG,
  getUniqueValueSlug,
} from '../../../../shared/note-values/constants'
import type { NoteValueProps } from '../../../../shared/note-values/types'

function isTextInlineContent(item: unknown): item is { type: 'text'; text: string } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    item.type === 'text' &&
    'text' in item &&
    typeof item.text === 'string'
  )
}

function isValueInlineContent(item: unknown): item is { type: 'value'; props: { slug: string } } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'type' in item &&
    item.type === 'value' &&
    'props' in item &&
    typeof item.props === 'object' &&
    item.props !== null &&
    'slug' in item.props &&
    typeof item.props.slug === 'string'
  )
}

export function createValueReferenceSlashMenuItem(
  editor: CustomBlockNoteEditor,
): DefaultReactSuggestionItem {
  return {
    title: 'Value',
    subtext: 'Create a referenceable value or formula',
    icon: <Sigma />,
    onItemClick: () => {
      const existingSlugs = collectEditorValueSlugs(editor.document)
      insertValueInlineForSlashMenu(editor, {
        valueId: crypto.randomUUID(),
        slug: getUniqueValueSlug(NOTE_VALUE_DEFAULT_SLUG, existingSlugs),
        expressionSource: '0',
      })
    },
    aliases: ['formula', 'stat', 'property'],
  }
}

function collectEditorValueSlugs(editorBlocks: Array<CustomBlock>): Array<string> {
  const slugs: Array<string> = []
  for (const block of editorBlocks) {
    slugs.push(...collectValueSlugs(block))
  }
  return slugs
}

function collectValueSlugs(editorBlock: CustomBlock): Array<string> {
  const slugs = collectValueSlugsFromContent(editorBlock.content)
  for (const child of editorBlock.children ?? []) {
    slugs.push(...collectValueSlugs(child))
  }
  return slugs
}

function collectValueSlugsFromContent(content: CustomBlock['content']): Array<string> {
  if (Array.isArray(content)) {
    return collectInlineValueSlugs(content)
  }
  if (content?.type === 'tableContent') {
    return content.rows.flatMap((row) =>
      row.cells.flatMap((cell) =>
        collectInlineValueSlugs(Array.isArray(cell) ? cell : cell.content),
      ),
    )
  }
  return []
}

function collectInlineValueSlugs(items: Array<unknown>): Array<string> {
  const slugs: Array<string> = []
  for (const item of items) {
    if (isValueInlineContent(item)) {
      slugs.push(item.props.slug)
    }
  }
  return slugs
}

function insertValueInlineForSlashMenu(editor: CustomBlockNoteEditor, props: NoteValueProps) {
  const valueInline = {
    type: 'value' as const,
    props,
  }
  if (replaceActiveSlashQuery(editor, valueInline)) {
    return
  }

  const cursor = editor.getTextCursorPosition()
  const content = cursor.block.content
  const shouldReplaceCurrent =
    Array.isArray(content) &&
    (content.length === 0 ||
      (content.length === 1 && isTextInlineContent(content[0]) && content[0].text === '/'))

  if (shouldReplaceCurrent) {
    editor.updateBlock(cursor.block, {
      content: [valueInline] as never,
    })
    editor.setTextCursorPosition(cursor.block, 'end')
    return
  }

  editor.insertInlineContent([valueInline] as never, { updateSelection: true })
}

function replaceActiveSlashQuery(
  editor: CustomBlockNoteEditor,
  valueInline: { type: 'value'; props: NoteValueProps },
): boolean {
  const tiptap = editor._tiptapEditor
  const view = tiptap?.view
  if (!tiptap || !view) return false

  const { selection } = view.state
  if (!selection.empty) return false

  const $from = selection.$from
  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '', '')
  const slashIndex = textBeforeCursor.lastIndexOf('/')
  if (slashIndex === -1) return false

  const query = textBeforeCursor.slice(slashIndex + 1)
  if (query.includes(' ') || query.includes('\n')) return false

  const from = $from.start() + slashIndex
  tiptap.chain().focus().setTextSelection({ from, to: selection.from }).run()
  editor.insertInlineContent([valueInline] as never, { updateSelection: true })
  return true
}
