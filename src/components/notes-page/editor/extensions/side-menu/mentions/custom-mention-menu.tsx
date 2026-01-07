import { SuggestionMenuController } from '@blocknote/react'
import { MentionMenuFooter } from './mention-menu-footer'
import type {
  DefaultReactSuggestionItem,
  SuggestionMenuProps,
} from '@blocknote/react'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'
import './mention-menu.css'

function CustomMentionSuggestionMenu(
  props: SuggestionMenuProps<DefaultReactSuggestionItem>,
) {
  return (
    <div className="mention-menu">
      <ScrollArea className="mention-menu-scroll-area">
        {props.items.map((item, index) => (
          <div
            key={index}
            className={`mention-menu-item ${
              props.selectedIndex === index ? 'selected' : ''
            }`}
            onClick={() => {
              props.onItemClick?.(item)
            }}
          >
            <div className="mention-menu-item-content">
              <div className="mention-menu-item-title-row">
                <span className="mention-menu-item-title">{item.title}</span>
                {item.badge && (
                  <span className="mention-menu-badge">{item.badge}</span>
                )}
              </div>
              {item.subtext && (
                <div className="mention-menu-item-subtext">{item.subtext}</div>
              )}
            </div>
          </div>
        ))}
      </ScrollArea>
      <MentionMenuFooter />
    </div>
  )
}

export default function CustomMentionMenu({
  getItems,
}: {
  getItems: (query: string) => Promise<Array<DefaultReactSuggestionItem>>
}) {
  return (
    <SuggestionMenuController
      triggerCharacter={'[['}
      getItems={getItems}
      suggestionMenuComponent={CustomMentionSuggestionMenu}
    />
  )
}
