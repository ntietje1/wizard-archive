import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { Sigma } from 'lucide-react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import {
  NOTE_VALUE_DEFAULT_SLUG,
  NOTE_VALUE_SLUG_OPTIONS,
} from '../../../../shared/note-values/constants'
import { extractNoteValueDefinitions } from '../../../../shared/note-values/extract-definitions'
import { NOTE_VALUE_PROP_DEFAULTS } from '../../../../shared/note-values/schema'
import { deduplicateSlug } from '../../../../shared/slugs'
import type { NoteValueProps } from '../../../../shared/note-values/schema'
import { createUuidV4 } from '~/shared/utils/create-uuid-v4'

export function createValueReferenceSlashMenuItem(
  editor: CustomBlockNoteEditor,
): DefaultReactSuggestionItem {
  return {
    title: 'Value',
    subtext: 'Create a referenceable value or formula',
    icon: <Sigma />,
    onItemClick: () => {
      const existingSlugs = extractNoteValueDefinitions(editor.document, null).map(
        (definition) => definition.slug,
      )
      insertValueInlineForSlashMenu(editor, {
        valueId: createUuidV4(),
        slug: deduplicateSlug(NOTE_VALUE_DEFAULT_SLUG, existingSlugs, NOTE_VALUE_SLUG_OPTIONS),
        expressionSource: NOTE_VALUE_PROP_DEFAULTS.expressionSource,
      })
    },
    aliases: ['formula', 'stat', 'property'],
  }
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
