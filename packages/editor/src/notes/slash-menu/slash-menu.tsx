import { SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { filterSuggestionItems } from '../../rich-text/filter-suggestion-items'
import { createValueReferenceSlashMenuItem } from '../value-block/value-block-slash-menu-item'
import { isInsideWikiLink } from '../wiki-link/utils'
import { createEmbedSlashMenuItem } from './embed-slash-menu-item'
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from '@blocknote/react'
import type { CustomBlockNoteEditor } from '../editor-schema'
import './slash-menu.css'

function shouldShowSlashMenu(editor: CustomBlockNoteEditor): boolean {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return false
  const { state } = tiptap
  const $pos = state.selection.$from
  const cursorPos = state.selection.from

  if (isInsideWikiLink(editor)) {
    return false
  }

  if (cursorPos < $pos.end()) {
    const charAfter = state.doc.textBetween(cursorPos, cursorPos + 1)
    if (charAfter && !/\s/.test(charAfter)) {
      return false
    }
  }

  return true
}

function CustomSlashMenu(props: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const { items, selectedIndex, onItemClick } = props

  if (items.length === 0) {
    return null
  }

  return (
    <div className="slash-menu" data-testid="slash-menu">
      <ScrollArea className="slash-menu-scroll-area" type="always">
        <div className="slash-menu-items" role="listbox" aria-label="Slash menu">
          {items.map((item, index) => (
            <div key={getSlashMenuItemKey(item, index)}>
              <button
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                className={`slash-menu-item${index === selectedIndex ? ' selected' : ''}`}
                onClick={() => onItemClick?.(item)}
              >
                {item.icon && <span className="slash-menu-item-icon">{item.icon}</span>}
                <span className="slash-menu-item-body">
                  <span className="slash-menu-item-title">{item.title}</span>
                  {item.subtext && <span className="slash-menu-item-subtitle">{item.subtext}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
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

export const SlashMenu = ({ editor }: { editor: CustomBlockNoteEditor }) => {
  const valueItem = createValueReferenceSlashMenuItem(editor)
  const embedItem = createEmbedSlashMenuItem(editor)

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      suggestionMenuComponent={CustomSlashMenu}
      getItems={(query) => {
        if (!shouldShowSlashMenu(editor)) {
          return Promise.resolve([])
        }
        return Promise.resolve(
          filterSuggestionItems(
            [valueItem, embedItem, ...getDefaultReactSlashMenuItems(editor)],
            query,
          ),
        )
      }}
    />
  )
}
