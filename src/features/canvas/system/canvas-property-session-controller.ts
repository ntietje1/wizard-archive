import type { CanvasEdgePatch } from '../edges/canvas-edge-types'

export interface CanvasPropertyPatchSet {
  nodeDataPatches: ReadonlyMap<string, Record<string, unknown>>
  edgePatches: ReadonlyMap<string, CanvasEdgePatch>
}

interface CanvasPropertySessionController {
  startPropertySession: (options: CanvasPropertySessionOptions) => void
  updatePropertyPreview: (applyChange: () => void) => void
  commitPropertySession: (applyChange?: () => void) => void
  cancelPropertySession: () => void
}

interface CanvasPropertySessionOptions {
  collectPatches: (applyChange: () => void) => CanvasPropertyPatchSet
  previewPatches: (patches: CanvasPropertyPatchSet) => void
  commitPatches: (patches: CanvasPropertyPatchSet) => void
}

export function createCanvasPropertySessionController(): CanvasPropertySessionController {
  let activeSession: CanvasPropertySessionOptions | null = null
  let latestPreview: CanvasPropertyPatchSet | null = null

  return {
    startPropertySession: (options) => {
      activeSession = options
      latestPreview = null
    },
    updatePropertyPreview: (applyChange) => {
      if (!activeSession) {
        return
      }

      const patches = activeSession.collectPatches(applyChange)
      latestPreview = patches
      activeSession.previewPatches(patches)
    },
    commitPropertySession: (applyChange) => {
      if (!activeSession) {
        return
      }

      const patches = applyChange ? activeSession.collectPatches(applyChange) : latestPreview
      if (patches) {
        activeSession.commitPatches(patches)
      }
      activeSession = null
      latestPreview = null
    },
    cancelPropertySession: () => {
      activeSession = null
      latestPreview = null
    },
  }
}
