import { LandingContainer } from '~/features/landing/components/landing-container'
import { SectionLabel } from '~/features/landing/components/section-label'
import { AssetPlaceholder } from '~/features/landing/components/asset-placeholder'

export function FeatureSharing() {
  return (
    <section id="features" className="py-24">
      <LandingContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionLabel>Block-Level Sharing</SectionLabel>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Control what each player sees.
            </h2>
            <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-primary">
              The rogue knows what the rogue knows.
            </p>
            <div className="mt-6 space-y-4 text-base text-muted-foreground leading-relaxed">
              <p>
                Every block in your notes — a paragraph, an image, a stat block — can be shared with
                or hidden from individual players. Not just pages. Not just folders. Individual
                blocks, individual players.
              </p>
              <p>
                The paladin sees the temple's public history. The rogue sees the hidden passage she
                discovered last session. The DM sees everything. All on the same page.
              </p>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>→ Block-level visibility per player</li>
              <li>→ Folder and page-level sharing with cascade</li>
              <li>→ Three simple permission levels: none, view, edit</li>
              <li>→ Share with one player or the whole group</li>
              <li>→ DM always retains full access</li>
            </ul>
          </div>
          <AssetPlaceholder label="Split view: DM view (all blocks visible with sharing indicators) vs. Player view (hidden blocks absent). Labels: 'DM view' / 'Player view'" />
        </div>
      </LandingContainer>
    </section>
  )
}
