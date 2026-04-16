import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'

export function FeatureViewAs() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <AssetPlaceholder label="DM interface showing 'Viewing as: Kira' dropdown active — content area visibly differs from the normal DM view" />
          </div>
          <div className="order-1 lg:order-2">
            <SectionLabel>View-As Mode</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Preview exactly what each player sees.
            </h2>
            <p className="mt-6 text-base text-muted-foreground leading-relaxed">
              Before you reveal the twist, make sure they can't already see it. Switch to any
              player's perspective with one click and see exactly what they see — which blocks are
              visible, which map pins appear, which folders are accessible. Then switch back and
              keep editing.
            </p>
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
