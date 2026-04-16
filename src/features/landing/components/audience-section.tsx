import { Globe2, ScrollText, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'

const personas = [
  {
    icon: ScrollText,
    title: 'Dungeon Masters & GMs',
    body: 'Your campaign, organized. Share exactly what your players need to see. Keep your secrets until the perfect moment. Run any system, any setting.',
  },
  {
    icon: Users,
    title: 'Players',
    body: 'Access the campaign without asking the DM. Browse maps, read lore, take notes — all in one place. Free to join, no subscription needed.',
  },
  {
    icon: Globe2,
    title: 'Virtual & In-Person Groups',
    body: "Whether your table is a kitchen table or a Discord call, the Wizard's Archive works the same way. One shared space, wherever you play.",
  },
] satisfies Array<{ icon: LucideIcon; title: string; body: string }>

export function AudienceSection() {
  return (
    <section className="py-24">
      <LandingContainer className="flex flex-col items-center">
        <SectionLabel>{"Who It's For"}</SectionLabel>
        <h2 className="mb-12 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Built for the whole table.
        </h2>
        <div className="grid w-full gap-6 md:grid-cols-3">
          {personas.map((persona) => (
            <div
              key={persona.title}
              className="rounded-lg border border-border/20 bg-secondary/20 p-8 text-center"
            >
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/12 text-primary">
                <persona.icon className="size-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{persona.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{persona.body}</p>
            </div>
          ))}
        </div>
      </LandingContainer>
    </section>
  )
}
