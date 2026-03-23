import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react'
import { isInsideWikiLink } from '../wiki-link/wiki-link-utils'
import type {
  DefaultReactSuggestionItem,
  SuggestionMenuProps,
} from '@blocknote/react'
import type { CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import { filterSuggestionItems } from '~/features/editor/utils/filter-suggestion-items'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import './slash-menu.css'

function shouldShowSlashMenu(editor: CustomBlockNoteEditor): boolean {
  const tiptap = editor._tiptapEditor
  if (!tiptap) return false
  const { state } = tiptap
  const $pos = state.selection.$from
  const cursorPos = state.selection.from

  // Don't show if inside a wikilink
  if (isInsideWikiLink(editor)) {
    return false
  }

  // Don't show if there's non-whitespace immediately after cursor
  if (cursorPos < $pos.end()) {
    const charAfter = state.doc.textBetween(cursorPos, cursorPos + 1)
    if (charAfter && !/\s/.test(charAfter)) {
      return false
    }
  }

  return true
}

// Custom menu component that hides when items array is empty
function CustomSlashMenu(
  props: SuggestionMenuProps<DefaultReactSuggestionItem>,
) {
  const { items, selectedIndex, onItemClick } = props

  // Don't render anything if no items
  if (items.length === 0) {
    return null
  }

  return (
    <div className="slash-menu">
      <ScrollArea className="slash-menu-scroll-area" type="always">
        <div className="slash-menu-items">
          {items.map((item, index) => (
            <div
              key={item.title}
              className={`slash-menu-item${index === selectedIndex ? ' selected' : ''}`}
              onClick={() => onItemClick?.(item)}
            >
              {item.icon && (
                <div className="slash-menu-item-icon">{item.icon}</div>
              )}
              <div className="slash-menu-item-body">
                <div className="slash-menu-item-title">{item.title}</div>
                {item.subtext && (
                  <div className="slash-menu-item-subtitle">{item.subtext}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

export const SlashMenu = ({ editor }: { editor: CustomBlockNoteEditor }) => {
  return (
    <SuggestionMenuController
      triggerCharacter={'/'}
      suggestionMenuComponent={CustomSlashMenu}
      getItems={(query) => {
        if (!shouldShowSlashMenu(editor)) {
          return Promise.resolve([])
        }
        return Promise.resolve(
          filterSuggestionItems(getDefaultReactSlashMenuItems(editor), query),
        )
      }}
    />
  )
}
