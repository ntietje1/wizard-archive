import { ArrowLeftRight, BookOpenText, Eye, MonitorPlay, Sparkles, Waypoints } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
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
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Keep everything in one place
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Notes, maps, visual planning, player access, and import/export all work together so the
            campaign can move from prep to play without changing tools.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6">
            <BentoCard
              icon={BookOpenText}
              title="Write campaign material quickly."
              body="Use a clean editor for session notes, locations, handouts, and reference material, with Markdown import and export when you need portability."
              visualLabel="Writing asset: clean editor with a session note, linked campaign references, sidebar outline, and import/export affordances visible"
              className="min-h-[32rem]"
            />
            <BentoCard
              icon={Waypoints}
              title="Connect related material."
              body="Link notes, maps, canvases, and files so the campaign stays navigable as it grows."
              className="min-h-[20rem]"
            />
          </div>

          <div className="flex flex-col gap-6">
            <BentoCard
              icon={Eye}
              title="Preview player access."
              body="Check the player-facing view before sharing material, so private prep and shared campaign context stay clearly separated."
              className="min-h-[20rem]"
            />
            <BentoCard
              icon={ArrowLeftRight}
              title="Keep your work portable."
              body="Import Markdown from your existing notes and export campaign material when you need a local copy or backup."
              className="min-h-[32rem]"
            />
          </div>

          <div className="flex flex-col gap-6">
            <BentoCard
              icon={Sparkles}
              title="Add structured campaign templates."
              body="Templates will help standardize repeated campaign material and keep important fields easy to reference."
              eyebrow="Coming Soon"
              className="min-h-[32rem]"
            />
            <BentoCard
              icon={MonitorPlay}
              title="Present shared scenes."
              body="Scenes will make player-facing presentation a native part of the workspace instead of a separate screen share or slideshow."
              eyebrow="Coming Soon"
              className="min-h-[20rem]"
            />
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
