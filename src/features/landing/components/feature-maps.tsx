import { Link } from '@tanstack/react-router'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { buttonVariants } from '~/features/shadcn/components/button'

export function FeatureMaps() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <AssetPlaceholder label="Run asset: campaign map beside related notes, interactive pins connected to location pages, visible session context, and a player-safe view indicator" />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Build your story through maps.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Upload a map, place pins, and connect each location directly to the notes or other
                maps behind it. Maps become part of the campaign workspace and a tool for
                organization instead of a separate reference image.
              </p>
              <p>
                Use maps during the session to navigate the campaign, reveal locations as the party
                travels, and give players a direct path into the material they can access.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Upload any image as a campaign map</li>
              <li>→ Link pins to notes, files, folders, and canvases</li>
              <li>→ Control when locations become visible</li>
              <li>→ Never forget where the party has been</li>
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
