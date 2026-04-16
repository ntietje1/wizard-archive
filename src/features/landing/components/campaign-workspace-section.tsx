import { Link } from '@tanstack/react-router'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { buttonVariants } from '~/features/shadcn/components/button'

export function CampaignWorkspaceSection() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Organization</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Organize the campaign without building a maze.
            </h2>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-primary">
              Collaborate in the same live workspace.
            </p>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Keep notes, lore, handouts, and session prep in one shared campaign hub with
                folders, search, bookmarks, and a structure that still feels easy to navigate when
                the session is moving fast.
              </p>
              <p>
                DMs and players work in the same live space instead of scattering the campaign
                across docs, chat threads, and recap messages. The result is a campaign that stays
                organized for the DM and legible for the whole table.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Hierarchical organization that stays easy to browse</li>
              <li>→ Search and bookmarks for the pages you need mid-session</li>
              <li>→ Shared notes and campaign context in one place</li>
              <li>→ Built for the whole table, not just solo prep</li>
            </ul>
            <Link
              to="/sign-up"
              className={buttonVariants({ size: 'lg', className: 'mt-8 px-6 text-base' })}
            >
              Get Organized
            </Link>
          </div>
          <AssetPlaceholder label="Campaign workspace showing the sidebar with clear folder structure, bookmarks or search, and a note open in the main pane with signs of active collaboration" />
        </div>
      </LandingContainer>
    </section>
  )
}
