import { Link } from '@tanstack/react-router'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { buttonVariants } from '~/features/shadcn/components/button'

export function FeatureCanvases() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Canvases</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Plan visually when a page is too rigid.
            </h2>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Think beyond the page.
            </p>
            <div className="mt-6 space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                Some campaign thinking is spatial. Use canvases for relationship webs, session prep,
                dungeon layouts, and conspiracy boards when a linear document stops being the right
                tool.
              </p>
              <p>
                Embed notes and other campaign content directly on the board so your planning space
                stays connected to the rest of the Archive instead of turning into a disconnected
                whiteboard.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Drawing tools and rich text blocks</li>
              <li>→ Embed notes, folders, and canvases as interactive nodes</li>
              <li>→ Multiple collaborators can work in the same board together</li>
              <li>→ Snapshot history with rollback</li>
              <li>→ Pan, zoom, and minimap navigation</li>
            </ul>
            <Link
              to="/sign-up"
              className={buttonVariants({ size: 'lg', className: 'mt-8 px-6 text-base' })}
            >
              Start Planning
            </Link>
          </div>
          <div>
            <AssetPlaceholder label="Canvas with text blocks, connecting lines, and embedded note nodes showing campaign content — a DM's planning board" />
          </div>
        </div>
      </LandingContainer>
    </section>
  )
}
