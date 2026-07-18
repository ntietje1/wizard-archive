import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import type { ReactNode } from 'react'

export type NoteSuggestionMenuItem = Readonly<{
  key?: string
  title: string
  subtext?: string
  icon?: ReactNode
}>

export function NoteSuggestionMenu<T extends NoteSuggestionMenuItem>({
  items,
  selectedIndex,
  onItemClick,
}: {
  items: ReadonlyArray<T>
  selectedIndex?: number
  onItemClick?: (item: T) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="slash-menu" data-testid="note-suggestion-menu">
      <ScrollArea className="slash-menu-scroll-area" type="always">
        <div className="slash-menu-items" role="listbox" aria-label="Suggestions">
          {items.map((item, index) => (
            <button
              key={item.key ?? `${item.title}\u001f${item.subtext ?? ''}\u001f${index}`}
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
