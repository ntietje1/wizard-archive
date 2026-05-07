import { Link } from '@tanstack/react-router'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { buttonVariants } from '~/features/shadcn/components/button'

export function FeatureCanvases() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Organize your thoughts in an infinite space.
            </h2>
            <div className="mt-6 space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                Sometimes planning your ideas together on a board is easier than writing directly.
                Use canvases for relationship maps, session prep, idea boards, location layouts, and
                anything else you can think of when a linear document is not the right tool.
              </p>
              <p>
                Embed notes and other campaign content directly on the board so your planning space
                stays connected to the rest of the Archive. Read and write notes without ever
                leaving the canvas.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Visual boards for planning campaign relationships and sessions</li>
              <li>→ Embed notes, folders, and canvases as interactive nodes</li>
              <li>→ Collaborate in the same board together with your players</li>
              <li>→ Draw and write anything, anywhere</li>
            </ul>
            <Link
              to="/sign-up"
              className={buttonVariants({ size: 'lg', className: 'mt-8 px-6 text-base' })}
            >
              Start Planning
            </Link>
          </div>
          <div>
            <AssetPlaceholder label="Plan asset: canvas with connected note cards, relationship lines, embedded campaign pages, comments or presence indicators, and a linked session prep note" />
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
