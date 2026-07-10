import { StaticFeatureSection } from '~/features/landing/components/static-feature-section'
import { SharingFeatureDemo } from '~/features/landing/components/landing-feature-demos'

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
      visual={<SharingFeatureDemo />}
      reverse
    />
  )
}
