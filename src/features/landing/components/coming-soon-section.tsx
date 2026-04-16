import { Grid3X3, Monitor } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'

function ComingSoonCard({
  icon: Icon,
  heading,
  body,
}: {
  icon: LucideIcon
  heading: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-secondary/30 p-8">
      <span className="inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
        Coming Soon
      </span>
      <div className="mt-5 flex items-start gap-4">
        <Icon className="mt-1 size-5 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-xl font-semibold text-foreground">{heading}</h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  )
}

export function ComingSoonSection() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid gap-6 md:grid-cols-2">
          <ComingSoonCard
            icon={Grid3X3}
            heading="Your notes, alive."
            body="Embeddable values that calculate, reference, and update in real time. Build interactive character sheets from simple blocks. Track a countdown across your campaign. Reference any value from anywhere. All the power of a spreadsheet, none of the spreadsheet."
          />
          <ComingSoonCard
            icon={Monitor}
            heading="Show, don't tell."
            body="Build visual reveals — characters, landscapes, dungeons, anything — and share them to every player's screen with one button press. No more screen sharing. No more PowerPoints. The moment is part of the app."
          />
        </div>
      </LandingContainer>
    </section>
  )
}
