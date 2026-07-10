import { MapFeatureDemo } from '~/features/landing/components/landing-feature-demos'
import { StaticFeatureSection } from '~/features/landing/components/static-feature-section'

const mapFeatures = [
  'upload an image as a map base',
  'drag and drop notes, folders, or other content to add pins on your map',
  'control when pins are visible to players',
]

export function FeatureMaps() {
  return (
    <StaticFeatureSection
      title="Build your story through maps"
      items={mapFeatures}
      cta="Drop a pin"
      visual={<MapFeatureDemo />}
      reverse
    />
  )
}
