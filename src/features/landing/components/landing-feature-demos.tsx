import {
  Eye,
  FileArchive,
  FileText,
  Folder,
  Image,
  Link2,
  MapPin,
  Network,
  Pencil,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/features/shadcn/components/button'
import { cn } from '~/features/shadcn/lib/utils'

const workspaceItems = [
  { icon: Folder, label: 'Season One', detail: '8 notes' },
  { icon: FileText, label: 'Session 12: The Canal Job', detail: 'open' },
  { icon: Image, label: 'Dockside sigil.png', detail: 'image' },
  { icon: FileArchive, label: 'player-handouts.zip', detail: 'files' },
]

const heroPreviewItems = [
  {
    label: 'Session 12',
    title: 'The bell tower route',
    body: "The crew can cross the canal roofline if they find the locksmith's token. Share the tower diagram only after the alarm is disabled.",
    linked: 'Faction web, Canal map',
    files: '2 handouts attached',
    visible: 'Visible: invitation note, public map pins, clue handout',
    hidden: 'Hidden: GM route notes',
  },
  {
    label: 'Faction web',
    title: 'Canal Crew pressure map',
    body: 'Marra Vale owes the dockmaster, but the locksmith answers to the canal crew. Bring either ally into the scene to change the negotiation.',
    linked: 'Marra Vale, Dockmaster Rusk',
    files: '1 portrait attached',
    visible: 'Visible: known allies and rivals',
    hidden: 'Hidden: crew debt ledger',
  },
  {
    label: 'Canal map',
    title: 'Canal district approach',
    body: 'Two public pins mark the market and bridge. The tower entrance stays hidden until the players recover the scratched invoice.',
    linked: 'Bell Tower Job, Blue-glass Invoice',
    files: 'Map image attached',
    visible: 'Visible: market and bridge pins',
    hidden: 'Hidden: tower entrance pin',
  },
  {
    label: 'Handouts',
    title: 'Blue-glass invoice',
    body: 'The invoice can be shared as a text handout once the party reaches the Salt Warehouse.',
    linked: 'Salt Warehouse, Session 12',
    files: 'blue-glass-invoice.txt',
    visible: 'Visible: player-safe invoice',
    hidden: 'Hidden: scratched signature note',
  },
]

const canvasNodes = [
  { id: 'npc', label: 'Marra Vale', meta: 'NPC', position: 'left-[11%] top-[17%]' },
  { id: 'crew', label: 'Canal Crew', meta: 'Faction', position: 'right-[9%] top-[22%]' },
  { id: 'heist', label: 'Bell Tower Job', meta: 'Session', position: 'left-[31%] bottom-[14%]' },
]

const templateTabs = [
  { id: 'character', label: 'Character', fields: ['Pronouns', 'Motivation', 'Secrets'] },
  { id: 'location', label: 'Location', fields: ['District', 'Threats', 'Rumors'] },
  { id: 'session', label: 'Session', fields: ['Scenes', 'Treasure', 'Recap'] },
]

type TemplateTabId = (typeof templateTabs)[number]['id']

export function HeroProductDemo() {
  const [selectedItem, setSelectedItem] = useState('Session 12')
  const previewItem =
    heroPreviewItems.find((item) => item.label === selectedItem) ?? heroPreviewItems[0]

  return (
    <section
      className="overflow-hidden rounded-lg border border-border/70 bg-background text-left shadow-sm"
      aria-label="Landing campaign workspace preview"
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Ironmere campaign</p>
          <p className="text-sm font-semibold text-foreground">{selectedItem}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
          Player preview ready
        </div>
      </div>
      <div className="grid min-h-[360px] grid-cols-1 md:grid-cols-[minmax(150px,0.75fr)_minmax(0,1.45fr)_minmax(150px,0.8fr)]">
        <HeroPreviewSidebar selectedItem={selectedItem} onSelectItem={setSelectedItem} />
        <HeroPreviewEditor item={previewItem} />
        <HeroPreviewPlayerAside item={previewItem} />
      </div>
    </section>
  )
}

function HeroPreviewSidebar({
  onSelectItem,
  selectedItem,
}: {
  onSelectItem: (item: string) => void
  selectedItem: string
}) {
  return (
    <nav
      className="border-b border-border/70 bg-muted/25 p-3 md:border-r md:border-b-0"
      aria-label="Preview items"
    >
      {heroPreviewItems.map((item) => (
        <button
          key={item.label}
          type="button"
          className={cn(
            'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground',
            selectedItem === item.label && 'bg-background text-foreground shadow-sm',
          )}
          aria-pressed={selectedItem === item.label}
          onClick={() => onSelectItem(item.label)}
        >
          <FileText className="size-3.5" aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function HeroPreviewEditor({ item }: { item: (typeof heroPreviewItems)[number] }) {
  return (
    <div className="flex flex-col p-5">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Pencil className="size-4" aria-hidden="true" />
        Editing local campaign notes
      </div>
      <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.body}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border/70 p-3">
          <p className="text-xs font-medium text-foreground">Linked content</p>
          <p className="mt-2 text-xs text-muted-foreground">{item.linked}</p>
        </div>
        <div className="rounded-md border border-border/70 p-3">
          <p className="text-xs font-medium text-foreground">Files</p>
          <p className="mt-2 text-xs text-muted-foreground">{item.files}</p>
        </div>
      </div>
    </div>
  )
}

function HeroPreviewPlayerAside({ item }: { item: (typeof heroPreviewItems)[number] }) {
  return (
    <aside className="border-t border-border/70 bg-muted/20 p-4 md:border-t-0 md:border-l">
      <p className="text-xs font-semibold text-foreground">Player view</p>
      <div className="mt-3 rounded-md border border-border/70 bg-background p-3 text-xs text-muted-foreground">
        {item.visible}
      </div>
      <div className="mt-3 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        {item.hidden}
      </div>
    </aside>
  )
}

export function WorkspaceFeatureDemo() {
  const [note, setNote] = useState('Draft the canal encounter, link the tower key, then export.')
  const [fileName, setFileName] = useState('session-12-brief.md')

  return (
    <section
      className="overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm"
      aria-label="Focused editor and files demo"
    >
      <div className="grid min-h-[360px] md:grid-cols-[0.82fr_1.18fr]">
        <WorkspaceFileList fileName={fileName} onFileNameChange={setFileName} />
        <WorkspaceEditor fileName={fileName} note={note} onNoteChange={setNote} />
      </div>
    </section>
  )
}

function WorkspaceFileList({
  fileName,
  onFileNameChange,
}: {
  fileName: string
  onFileNameChange: (fileName: string) => void
}) {
  return (
    <div className="border-b border-border/70 bg-muted/25 p-4 md:border-r md:border-b-0">
      <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Campaign files</p>
      {workspaceItems.map((item) => (
        <div key={item.label} className="mb-2 flex items-center gap-3 rounded-md bg-background p-2">
          <item.icon className="size-4 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </div>
        </div>
      ))}
      <label className="mt-4 block">
        <span className="mb-2 block text-xs font-medium text-foreground">Rename local file</span>
        <input
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-control-focus-ring"
          value={fileName}
          onChange={(event) => onFileNameChange(event.currentTarget.value)}
        />
      </label>
    </div>
  )
}

function WorkspaceEditor({
  fileName,
  note,
  onNoteChange,
}: {
  fileName: string
  note: string
  onNoteChange: (note: string) => void
}) {
  return (
    <div className="flex min-h-0 flex-col p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ScrollText className="size-4" aria-hidden="true" />
        {fileName}
      </div>
      <label className="mt-4 flex min-h-0 flex-1 flex-col">
        <span className="sr-only">Landing demo note body</span>
        <textarea
          className="min-h-[190px] flex-1 resize-none rounded-md border border-border bg-muted/20 p-3 text-sm leading-6 text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-control-focus-ring"
          value={note}
          onChange={(event) => onNoteChange(event.currentTarget.value)}
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="size-4" aria-hidden="true" />
        Linked to Faction web
        <span aria-hidden="true">|</span>
        Markdown-ready export
      </div>
    </div>
  )
}

export function SharingFeatureDemo() {
  const [playersCanEdit, setPlayersCanEdit] = useState(false)
  const [clueVisible, setClueVisible] = useState(true)

  return (
    <section
      className="rounded-lg border border-border/70 bg-background p-4 shadow-sm"
      aria-label="Focused sharing demo"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_0.85fr]">
        <div className="rounded-md border border-border/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">GM note</p>
            <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
              private draft
            </span>
          </div>
          <p className="mt-4 border-l-2 border-primary/60 pl-3 text-sm text-foreground">
            The signal bell is cracked. This clue can be shared once the players inspect the tower.
          </p>
          <div className="mt-5 grid gap-2">
            <Button
              type="button"
              variant={clueVisible ? 'default' : 'outline'}
              size="sm"
              aria-pressed={clueVisible}
              onClick={() => setClueVisible((value) => !value)}
            >
              <Eye aria-hidden="true" />
              {clueVisible ? 'Hide clue from players' : 'Share clue with players'}
            </Button>
            <Button
              type="button"
              variant={playersCanEdit ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={playersCanEdit}
              onClick={() => setPlayersCanEdit((value) => !value)}
            >
              <Users aria-hidden="true" />
              {playersCanEdit ? 'Disable player edits' : 'Allow player edits'}
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Player preview</p>
          <div className="mt-4 rounded-md border border-border/70 bg-background p-3 text-sm text-muted-foreground">
            {clueVisible ? 'Visible clue: The bell is cracked.' : 'No tower clue shared yet.'}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Access: {playersCanEdit ? 'collaborative editing enabled' : 'read-only player view'}
          </p>
        </div>
      </div>
    </section>
  )
}

export function MapFeatureDemo() {
  return (
    <section
      className="relative overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm"
      aria-label="Focused map planning preview"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,var(--muted)_0,transparent_24%),linear-gradient(135deg,transparent_0_48%,var(--border)_49%_51%,transparent_52%)] opacity-70" />
      <div className="relative min-h-[360px] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Canal district</p>
            <h3 className="text-lg font-semibold text-foreground">Map pins from campaign items</h3>
          </div>
          <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
            canvas-backed maps planned
          </span>
        </div>
        <div className="absolute top-[32%] left-[18%] rounded-md border border-border bg-background p-2 shadow-sm">
          <MapPin className="size-4 text-rose-600" aria-hidden="true" />
        </div>
        <div className="absolute top-[53%] right-[25%] rounded-md border border-border bg-background p-2 shadow-sm">
          <MapPin className="size-4 text-amber-600" aria-hidden="true" />
        </div>
        <div className="absolute right-5 bottom-5 w-[210px] rounded-md border border-border bg-background p-3">
          <p className="text-xs font-semibold text-foreground">Selected pin</p>
          <p className="mt-2 text-xs text-muted-foreground">Tower entrance linked to Session 12.</p>
          <p className="mt-3 text-xs text-muted-foreground">Player visibility: hidden</p>
        </div>
      </div>
    </section>
  )
}

export function CanvasFeatureDemo() {
  const [selectedNode, setSelectedNode] = useState(canvasNodes[0].id)

  return (
    <section
      className="relative overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm"
      aria-label="Focused canvas planning demo"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
        <Network className="size-4 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">Relationship canvas</p>
      </div>
      <div className="relative min-h-[330px] bg-muted/20">
        <svg className="absolute inset-0 size-full" aria-hidden="true">
          <line x1="25%" y1="31%" x2="72%" y2="35%" className="stroke-border" strokeWidth="2" />
          <line x1="28%" y1="31%" x2="44%" y2="73%" className="stroke-border" strokeWidth="2" />
          <path
            d="M45 245 C160 185, 245 255, 345 176"
            className="stroke-primary/50"
            fill="none"
            strokeWidth="3"
          />
        </svg>
        {canvasNodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className={cn(
              'absolute w-[148px] rounded-md border bg-background p-3 text-left shadow-sm transition-colors',
              node.position,
              selectedNode === node.id
                ? 'border-primary'
                : 'border-border hover:border-foreground/35',
            )}
            aria-pressed={selectedNode === node.id}
            onClick={() => setSelectedNode(node.id)}
          >
            <p className="text-sm font-semibold text-foreground">{node.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{node.meta}</p>
          </button>
        ))}
        <div className="absolute bottom-4 left-4 flex gap-2 rounded-md border border-border bg-background p-2">
          <Pencil className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Draw, connect, embed</span>
        </div>
      </div>
    </section>
  )
}

export function TemplatesFeatureDemo() {
  const [activeTemplate, setActiveTemplate] = useState<TemplateTabId>('character')
  const template = templateTabs.find((item) => item.id === activeTemplate) ?? templateTabs[0]

  return (
    <section
      className="rounded-lg border border-border/70 bg-background p-4 shadow-sm"
      aria-label="Focused template demo"
    >
      <div className="flex flex-wrap gap-2" aria-label="Template examples">
        {templateTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={activeTemplate === item.id}
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium',
              activeTemplate === item.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTemplate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-md border border-border bg-muted/25 p-4">
          <Sparkles className="size-5 text-amber-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">{template.label} template</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Reusable structure for campaign prep.
          </p>
        </div>
        <div className="space-y-2">
          {template.fields.map((field) => (
            <div key={field} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium text-foreground">{field}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Field ready for notes, files, and links.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
