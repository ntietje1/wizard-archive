import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'

export function FeatureRealtime() {
  return (
    <section className="py-24">
      <LandingContainer className="flex flex-col items-center text-center">
        <SectionLabel>Real-Time</SectionLabel>
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {"Everyone's in. Everyone's up to date."}
        </h2>
        <p className="mt-6 max-w-[600px] text-base text-muted-foreground leading-relaxed">
          {
            'Multiple users can edit the same note, canvas, or map at the same time. Changes appear instantly. No saving, no syncing, no "refresh to see updates." Between sessions, your players can catch up on their own — the notes are already there.'
          }
        </p>
        <p className="mt-4 text-base font-medium text-primary">
          {'Never need a session recap — everyone was there, and the notes prove it.'}
        </p>
        <div className="mt-12 w-full max-w-4xl">
          <AssetPlaceholder label="Editor with 2+ named colored cursors (e.g., 'Alex', 'Jordan') editing mid-session notes simultaneously" />
        </div>
      </LandingContainer>
    </section>
  )
}
