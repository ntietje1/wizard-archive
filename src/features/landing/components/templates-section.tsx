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
      visualDescription="Templates preview: a multi-faceted template workspace showing campaign templates such as characters, locations, sessions, lore, timelines, and family trees. The mockup should show one selected template backed by multiple supporting images or panels, similar to Obsidian's multi-image feature sections."
      reverse
    />
  )
}
