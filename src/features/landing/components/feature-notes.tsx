import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'

export function FeatureNotes() {
  return (
    <section className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Notes</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Write like you think.
            </h2>
            <div className="mt-6 space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                A block-based editor that gets out of your way. Type "/" for slash commands. Drag
                blocks to rearrange. Format with a floating toolbar. If you've used Notion, you
                already know how this works — except this one is built for campaigns.
              </p>
              <p>
                Import and export in Markdown. Bring your existing notes from Obsidian or any other
                tool. Take them with you if you ever leave. No lock-in.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Slash commands and formatting toolbar</li>
              <li>→ Drag-to-reorder blocks</li>
              <li>→ Markdown import/export (single notes and entire folders)</li>
              <li>→ Hierarchical sidebar with folders, search, and bookmarks</li>
              <li>→ Soft-delete with trash and recovery</li>
            </ul>
          </div>
          <AssetPlaceholder label="Block editor with slash command menu open or formatting toolbar visible. Content: system-agnostic NPC/location entry with a visible [[wiki-link]]" />
        </div>
      </LandingContainer>
    </section>
  )
}
