import { FileText, MapPin, Network, ScrollText } from 'lucide-react'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import type { Id } from 'convex/_generated/dataModel'
import type { CustomBlock } from 'shared/editor-blocks/types'

const suggestions = [
  {
    title: 'Moonwell Docks',
    subtitle: 'Locations/',
    badge: 'map',
    icon: MapPin,
    selected: true,
  },
  {
    title: 'Moonlit Warehouse',
    subtitle: 'Locations/Docks/',
    badge: 'note',
    icon: FileText,
    selected: false,
  },
  {
    title: 'Moon Market Escape',
    subtitle: 'Scenes/',
    badge: 'canvas',
    icon: Network,
    selected: false,
  },
  {
    title: 'Moonsilver Invoice',
    subtitle: 'Handouts/',
    badge: 'file',
    icon: ScrollText,
    selected: false,
  },
]

const editorContent: Array<CustomBlock> = [
  {
    id: 'landing-link-preview-setup',
    type: 'paragraph',
    props: {},
    content: [
      {
        type: 'text',
        text: 'The auction bell rings twice before [[Mara Vell]] slips through the crowd with the [[Blue-glass Invoice]].',
        styles: {},
      },
    ],
    children: [],
  },
  {
    id: 'landing-link-preview-draft',
    type: 'paragraph',
    props: {},
    content: [
      {
        type: 'text',
        text: 'The clue connects the [[The Lantern Market]] to the [[Harbor Heist Board]], but the courier vanishes before the party reaches [[moon',
        styles: {},
      },
    ],
    children: [],
  },
]

export function LandingEditorLinkPreview() {
  return (
    <section
      className="demo-elevated-frame h-[420px] overflow-hidden rounded-lg border border-border/70 bg-background"
      aria-label="Text editor link autocomplete preview"
    >
      <div className="relative h-full bg-background px-2 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto h-full max-w-[36rem] overflow-hidden">
          <RawNoteContent
            noteId={'landing-link-preview' as Id<'sidebarItems'>}
            content={editorContent}
            editable={false}
            className="note-editor-surface"
          />
        </div>
        <div
          className="absolute left-1/2 top-[12.75rem] w-[min(22rem,calc(100%-3rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl sm:left-[calc(50%+1rem)] sm:translate-x-0"
          aria-label="Link suggestions"
        >
          <div className="p-1">
            {suggestions.map((suggestion) => {
              const Icon = suggestion.icon

              return (
                <div
                  key={suggestion.title}
                  data-selected={suggestion.selected ? 'true' : undefined}
                  className={`flex items-start gap-2 rounded-md px-2.5 py-2 ${
                    suggestion.selected ? 'bg-accent text-accent-foreground' : ''
                  }`}
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{suggestion.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.subtitle}
                    </span>
                  </span>
                  <span className="mt-0.5 inline-flex h-4 shrink-0 items-center rounded-sm border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    {suggestion.badge}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-evenly gap-3 border-t border-border/50 px-2 py-1 text-[10px] text-muted-foreground">
            <span>up/down navigate</span>
            <span>enter select</span>
            <span>tab continue</span>
          </div>
        </div>
      </div>
    </section>
  )
}
