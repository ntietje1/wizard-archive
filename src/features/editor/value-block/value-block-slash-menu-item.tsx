import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { Sigma } from 'lucide-react'
import type { CustomBlock, CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import {
  NOTE_VALUE_DEFAULT_SLUG,
  NOTE_VALUE_SLUG_OPTIONS,
} from '../../../../shared/note-values/constants'
import { deduplicateSlug } from '../../../../shared/slugs'
import type { NoteValueProps } from '../../../../shared/note-values/types'
import { createUuidV4 } from '~/shared/utils/create-uuid-v4'

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
        valueId: createUuidV4(),
        slug: deduplicateSlug(NOTE_VALUE_DEFAULT_SLUG, existingSlugs, NOTE_VALUE_SLUG_OPTIONS),
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

  editor.insertInlineContent([valueInline], { updateSelection: true })
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
  editor.insertInlineContent([valueInline], { updateSelection: true })
  return true
}
