import { Link } from '@tanstack/react-router'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { buttonVariants } from '~/features/shadcn/components/button'

export function FeatureMaps() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <AssetPlaceholder label="Campaign map with interactive pins, visible labels/tooltips, and a mix of player-visible and DM-only locations" />
          </div>
          <div className="order-1 lg:order-2">
            <SectionLabel>Maps</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your map. Your pins. Your rules.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Upload any map image, place pins anywhere, and connect each location directly to the
                notes, files, and lore behind it. A map stops being a reference image and becomes
                part of the campaign flow.
              </p>
              <p>
                Reveal locations when the party earns them, keep hidden discoveries private until
                the right moment, and let players click straight into the content that matters
                without leaving the world behind.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Upload any image as a game map</li>
              <li>→ Interactive pins linked to notes, files, and folders</li>
              <li>→ Per-player pin visibility for controlled reveals</li>
              <li>→ Pan and zoom around the world with ease</li>
              <li>→ Turn locations into navigable campaign hubs</li>
            </ul>
            <Link
              to="/sign-up"
              className={buttonVariants({ size: 'lg', className: 'mt-8 px-6 text-base' })}
            >
              Drop a Pin
            </Link>
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
