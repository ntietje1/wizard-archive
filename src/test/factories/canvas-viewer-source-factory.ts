import type { CanvasViewerSource } from '~/features/canvas/components/canvas-viewer-source'

export function createTestCanvasViewerSource(): CanvasViewerSource {
  return {
    SourceComponent: () => null,
    RuntimeComponent: () => null,
  }
}
