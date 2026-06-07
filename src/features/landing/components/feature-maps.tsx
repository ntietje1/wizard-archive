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
      visualDescription="Map preview: an uploaded campaign map image with pins dropped onto locations. The mockup should show notes, folders, or other campaign content attached to pins, plus visibility controls for deciding when each pin is visible to players."
      visual={<MapFeatureDemo />}
      reverse
    />
  )
}
