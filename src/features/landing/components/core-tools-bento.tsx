import { ArrowLeftRight, BookOpenText, Eye, MonitorPlay, Sparkles, Waypoints } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { cn } from '~/features/shadcn/lib/utils'

type CardProps = {
  icon: LucideIcon
  title: string
  body: string
  eyebrow?: string
  className?: string
  visualLabel?: string
  visualAspectRatio?: string
}

function BentoCard({
  icon: Icon,
  title,
  body,
  eyebrow,
  className,
  visualLabel,
  visualAspectRatio,
}: CardProps) {
  return (
    <article
      className={cn('rounded-2xl border border-border/30 bg-secondary/25 p-6 shadow-sm', className)}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Icon className="size-5" />
        </div>
        {eyebrow ? (
          <span className="rounded-full bg-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </span>
        ) : null}
      </div>

      <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{body}</p>

      {visualLabel ? (
        <div className="mt-6">
          <AssetPlaceholder label={visualLabel} aspectRatio={visualAspectRatio} />
        </div>
      ) : null}
    </article>
  )
}

export function CoreToolsBento() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>Core Tools</SectionLabel>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Run the whole campaign without breaking your flow.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Notes, links, maps, player visibility, and import workflows all work together in one
            shared workspace. The roadmap sits right next to the shipped product, clearly marked.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6">
            <BentoCard
              icon={BookOpenText}
              title="Write and rearrange notes at the speed of thought."
              body="Use a clean block editor with slash commands, drag-to-reorder, Markdown import and export, and a workspace structure that still feels simple mid-session."
              visualLabel="Block editor with slash commands open, formatted campaign notes, and a visible wiki-link embedded in the text"
              className="min-h-[32rem]"
            />
            <BentoCard
              icon={Waypoints}
              title="Link everything as you go."
              body="Type [[ to connect notes, maps, canvases, and files so your campaign stays navigable even when the lore gets dense."
              className="min-h-[20rem]"
            />
          </div>

          <div className="flex flex-col gap-6">
            <BentoCard
              icon={Eye}
              title="Check exactly what a player can see."
              body="Swap into any player's perspective before you reveal the next twist so you can confirm which blocks, pins, and pages are actually visible."
              className="min-h-[20rem]"
            />
            <BentoCard
              icon={ArrowLeftRight}
              title="Bring your notes in and take them back out."
              body="Import Markdown from the tools you already use, export individual notes or whole folders when you need them, and move into the Archive without feeling locked there."
              className="min-h-[32rem]"
            />
          </div>

          <div className="flex flex-col gap-6">
            <BentoCard
              icon={Sparkles}
              title="Build notes that calculate and update themselves."
              body="Templates will let you embed live values, derived stats, countdowns, and referenceable fields anywhere in the campaign."
              eyebrow="Coming Soon"
              className="min-h-[32rem]"
            />
            <BentoCard
              icon={MonitorPlay}
              title="Push a scene to every player's screen at the right moment."
              body="Scenes will turn reveals into a native part of the app instead of a screen share, slideshow, or Discord image dump."
              eyebrow="Coming Soon"
              className="min-h-[20rem]"
            />
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
