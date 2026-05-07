import { Globe2, ScrollText, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LandingContainer } from '~/features/landing/components/landing-container'

const personas = [
  {
    icon: ScrollText,
    title: 'DMs and campaign creators',
    body: 'Write, organize, and run the campaign from one workspace. Keep private prep separate from the material players can access.',
  },
  {
    icon: Users,
    title: 'Players',
    body: 'Access all campaign content without a subscription. Players join free and see only what has been shared with them.',
  },
  {
    icon: Globe2,
    title: 'Online and in-person tables',
    body: 'Use the same campaign workspace whether the table meets in person, online, or both. Everyone works from the same source of truth.',
  },
] satisfies Array<{ icon: LucideIcon; title: string; body: string }>

export function AudienceSection() {
  return (
    <section className="py-24">
      <LandingContainer className="flex flex-col items-center">
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
