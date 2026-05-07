import { Link } from '@tanstack/react-router'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { buttonVariants } from '~/features/shadcn/components/button'

export function FeatureSharing() {
  return (
    <section id="features" className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <AssetPlaceholder label="Share asset: split product view with a GM workspace on the left, player view on the right, visible sharing indicators, and only shared material appearing in the player preview" />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Share the right material with each player.
            </h2>
            <div className="mt-6 space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                Keep prep, notes, maps, and private context in the same workspace while deciding
                what players can access. You can share entire notes or specific blocks with the
                entire table or specific players.
              </p>
              <p>
                Check the player view before a reveal, then keep the campaign moving without
                duplicating notes into separate documents or messages.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Share with one player or the whole group</li>
              <li>→ Keep private prep and shared material together</li>
              <li>→ Preview what players can access before you reveal it</li>
              <li>→ Players have their own sharable notes</li>
            </ul>
            <Link
              to="/sign-up"
              className={buttonVariants({ size: 'lg', className: 'mt-8 px-6 text-base' })}
            >
              Start Sharing
            </Link>
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
