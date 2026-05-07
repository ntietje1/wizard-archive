import { Link } from '@tanstack/react-router'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'
import { LandingContainer } from '~/features/landing/components/landing-container'
import { buttonVariants } from '~/features/shadcn/components/button'

export function CampaignWorkspaceSection() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Write and plan your campaign in one place.
            </h2>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                Keep notes, lore, handouts, and session prep in one campaign hub with folders,
                search, bookmarks, links, and Markdown import/export.
              </p>
              <p>
                The same workspace you use to prepare becomes the place your group uses during play,
                so campaign material does not have to be copied across docs, chat threads, and recap
                notes.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Folders, search, tags, and bookmarks for fast navigation</li>
              <li>→ Linked notes and documents for campaign context and references</li>
              <li>→ Markdown import and export for portable campaign writing</li>
              <li>→ A workspace built for the whole table, not just solo prep</li>
            </ul>
            <Link
              to="/sign-up"
              className={buttonVariants({ size: 'lg', className: 'mt-8 px-6 text-base' })}
            >
              Get Organized
            </Link>
          </div>
          <AssetPlaceholder label="Prepare asset: campaign sidebar with folders and bookmarks, search results open, a structured session note in the editor, visible internal links, and Markdown-style content ready to export" />
        </div>
      </LandingContainer>
    </section>
  )
}
