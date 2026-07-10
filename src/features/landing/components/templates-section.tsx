import { TemplateFeatureDemo } from '~/features/landing/components/landing-feature-demos'
import { StaticFeatureSection } from '~/features/landing/components/static-feature-section'

const templateFeatures = [
  'start with characters, locations, sessions, and lore',
  'add fields, images, maps, files, and links',
  'reuse formats across your campaign',
  'build timelines, factions, and family trees',
]

export function TemplatesSection() {
  return (
    <StaticFeatureSection
      title="Start faster with templates"
      items={templateFeatures}
      cta="Use templates"
      visual={<TemplateFeatureDemo />}
      reverse
    />
  )
}
