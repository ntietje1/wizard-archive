import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'

export function FeatureWikiLinks() {
  return (
    <section className="py-24">
      <LandingContainer className="flex flex-col items-center text-center">
        <SectionLabel>Connections</SectionLabel>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Link everything. Find anything.
        </h2>
        <p className="mt-6 max-w-[600px] text-base text-muted-foreground leading-relaxed">
          Use [[Wiki Links]] to link to any note, map, canvas, or file in your campaign.
          Autocomplete helps you find it. Links are navigable and bidirectional — never forget who a
          character is, what happened last session, or where your party has been.
        </p>
      </LandingContainer>
    </section>
  )
}
