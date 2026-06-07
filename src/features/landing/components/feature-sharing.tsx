import { SharingFeatureDemo } from '~/features/landing/components/landing-feature-demos'
import { StaticFeatureSection } from '~/features/landing/components/static-feature-section'

const sharingFeatures = [
  'share blocks, whole notes, or other content (images, files, maps, canvases) with all or specific players',
  'give edit access to allow real-time collaboration',
  'preview what players can see any time',
]

export function FeatureSharing() {
  return (
    <StaticFeatureSection
      id="features"
      title="Share notes as you plan or play"
      items={sharingFeatures}
      cta="Start sharing"
      visualDescription="Sharing preview: a split GM and player view showing shared blocks, notes, images, files, maps, and canvases. The mockup should include per-player access controls, edit access for collaboration, and a clear preview mode for what players can currently see."
      visual={<SharingFeatureDemo />}
      reverse
    />
  )
}
