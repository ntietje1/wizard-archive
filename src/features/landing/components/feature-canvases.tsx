import { CanvasFeatureDemo } from '~/features/landing/components/landing-feature-demos'
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
      visualDescription="Canvas preview: the public-safe read-only canvas surface rendered with demo campaign data."
      visual={<CanvasFeatureDemo />}
    />
  )
}
