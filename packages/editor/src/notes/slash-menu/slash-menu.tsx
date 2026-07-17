import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from '@blocknote/react'
import { Sigma } from 'lucide-react'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import type { NoteBlockNoteEditor } from '../note-editor-schema'
import { insertNoteValueFromSlashMenu } from './value-slash-menu'
import './slash-menu.css'

export function NoteSlashMenu({ editor }: { editor: NoteBlockNoteEditor }) {
  const items = [createValueItem(editor), ...getDefaultReactSlashMenuItems(editor)]

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      suggestionMenuComponent={NoteSlashMenuContent}
      getItems={(query) =>
        Promise.resolve(shouldShowSlashMenu(editor) ? filterSuggestionItems(items, query) : [])
      }
    />
  )
}

function NoteSlashMenuContent(props: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const { items, selectedIndex, onItemClick } = props
  if (items.length === 0) return null

  return (
    <div className="slash-menu" data-testid="slash-menu">
      <ScrollArea className="slash-menu-scroll-area" type="always">
        <div className="slash-menu-items" role="listbox" aria-label="Slash menu">
          {items.map((item, index) => (
            <button
              key={getSlashMenuItemKey(item, index)}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={`slash-menu-item${index === selectedIndex ? ' selected' : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                onItemClick?.(item)
              }}
            >
              {item.icon && <span className="slash-menu-item-icon">{item.icon}</span>}
              <span className="slash-menu-item-body">
                <span className="slash-menu-item-title">{item.title}</span>
                {item.subtext && <span className="slash-menu-item-subtitle">{item.subtext}</span>}
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
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

function getSlashMenuItemKey(item: DefaultReactSuggestionItem, index: number) {
  const iconKey =
    typeof item.icon === 'string'
      ? item.icon
      : item.icon && typeof item.icon === 'object' && 'key' in item.icon
        ? String(item.icon.key)
        : null
  return [item.title, item.subtext ?? '', iconKey ?? '', index].join('\u001f')
}
