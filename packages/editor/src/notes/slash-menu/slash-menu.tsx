import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import type { DefaultReactSuggestionItem } from '@blocknote/react'
import { Sigma } from 'lucide-react'
import type { NoteBlockNoteEditor } from '../note-editor-schema'
import { NoteSuggestionMenu } from '../note-suggestion-menu'
import { insertNoteValueFromSlashMenu } from './value-slash-menu'
import { createEmbedItem } from './embed-slash-menu'
import './slash-menu.css'

export function NoteSlashMenu({ editor }: { editor: NoteBlockNoteEditor }) {
  const items = [
    createValueItem(editor),
    createEmbedItem(editor),
    ...getDefaultReactSlashMenuItems(editor),
  ]

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      suggestionMenuComponent={NoteSuggestionMenu}
      getItems={(query) =>
        Promise.resolve(shouldShowSlashMenu(editor) ? filterSuggestionItems(items, query) : [])
      }
    />
  )
}

function createValueItem(editor: NoteBlockNoteEditor): DefaultReactSuggestionItem {
  return {
    title: 'Value',
    subtext: 'Create a referenceable value or formula',
    aliases: ['formula', 'stat', 'property'],
    icon: <Sigma />,
    onItemClick: () => insertNoteValueFromSlashMenu(editor),
  }
}

function shouldShowSlashMenu(editor: NoteBlockNoteEditor) {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return false
  const { state } = tiptap
  const cursorPosition = state.selection.from
  const selectionPosition = state.selection.$from
  if (cursorPosition >= selectionPosition.end()) return true

  const characterAfterCursor = state.doc.textBetween(cursorPosition, cursorPosition + 1)
  return !characterAfterCursor || /\s/.test(characterAfterCursor)
}

function filterSuggestionItems(items: Array<DefaultReactSuggestionItem>, query: string) {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return items
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(normalizedQuery) ||
      item.aliases?.some((alias) => alias.toLowerCase().includes(normalizedQuery)),
  )
}
