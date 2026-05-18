import { StaticFeatureSection } from '~/features/landing/components/static-feature-section'

const canvasFeatures = [
  'drag and drop content to embed it',
  'easily connect notes and other content',
  'draw and write anywhere',
  'make family trees, timelines, etc.',
]

export function FeatureCanvases() {
  return (
    <StaticFeatureSection
      title="Organize your thoughts on a canvas"
      items={canvasFeatures}
      cta="Start planning"
      visualDescription="Canvas preview: a planning board with embedded notes, maps, files, and folders arranged as cards. The mockup should show connectors between items, freehand drawing and writing, and examples like a family tree or timeline."
    />
  )
}
