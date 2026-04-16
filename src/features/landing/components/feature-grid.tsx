import { ArrowLeftRight, Bookmark, FolderOpen, Paintbrush, Shield, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'

const cards: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Users,
    title: 'Campaigns & Sessions',
    body: "Create campaigns, invite players with a link, and track sessions. Your group's home base — everything lives here.",
  },
  {
    icon: Shield,
    title: 'Permissions',
    body: 'Three levels — none, view, edit — applied to any item or folder. Permissions cascade to children. Simple to set, impossible to break.',
  },
  {
    icon: FolderOpen,
    title: 'File Management',
    body: 'Upload images, PDFs, and documents. Preview, organize, and link them anywhere in your campaign.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Import & Export',
    body: 'Markdown in. Markdown out. Single notes or entire folders. Bring your existing work. Leave with everything. No lock-in.',
  },
  {
    icon: Bookmark,
    title: 'Search & Bookmarks',
    body: 'Find anything instantly. Bookmark your most-used items for one-click access during sessions.',
  },
  {
    icon: Paintbrush,
    title: 'Themes',
    body: 'Dark and light mode built in. Expanded theme customization coming soon.',
  },
]

export function FeatureGrid() {
  return (
    <section className="py-24">
      <LandingContainer className="flex flex-col items-center">
        <SectionLabel>And Everything Else</SectionLabel>
        <h2 className="mb-12 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          The details that make it work.
        </h2>
        <p className="mb-12 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
          The big moments happen in sharing, view-as, and the core workspace. These are the
          supporting pieces that make the whole campaign feel dependable every time your group sits
          down to play.
        </p>
        <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-border/20 bg-secondary/20 p-6"
            >
              <card.icon className="mb-3 size-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      </LandingContainer>
    </section>
  )
}
