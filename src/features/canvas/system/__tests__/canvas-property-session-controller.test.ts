import { describe, expect, it, vi } from 'vitest'
import { createCanvasPropertySessionController } from '../canvas-property-session-controller'
import type { CanvasPropertyPatchSet } from '../canvas-property-session-controller'

describe('createCanvasPropertySessionController', () => {
  it('previews patches without committing document writes', () => {
    const controller = createCanvasPropertySessionController()
    const previewPatches = vi.fn()
    const commitPatches = vi.fn()
    const patches = createPatchSet('node-1', { borderWidth: 4 })

    controller.startPropertySession({
      collectPatches: (applyChange) => {
        applyChange()
        return patches
      },
      previewPatches,
      commitPatches,
    })
    controller.updatePropertyPreview(() => undefined)

    expect(previewPatches).toHaveBeenCalledWith(patches)
    expect(commitPatches).not.toHaveBeenCalled()
  })

  it('commits the latest preview as one patch set', () => {
    const controller = createCanvasPropertySessionController()
    const commitPatches = vi.fn()
    const firstPatch = createPatchSet('node-1', { borderWidth: 2 })
    const secondPatch = createPatchSet('node-1', { borderWidth: 6 })
    const patches = [firstPatch, secondPatch]

    controller.startPropertySession({
      collectPatches: () => patches.shift() ?? secondPatch,
      previewPatches: () => undefined,
      commitPatches,
    })
    controller.updatePropertyPreview(() => undefined)
    controller.updatePropertyPreview(() => undefined)
    controller.commitPropertySession()

    expect(commitPatches).toHaveBeenCalledTimes(1)
    expect(commitPatches).toHaveBeenCalledWith(secondPatch)
  })

  it('uses the commit callback patch when provided', () => {
    const controller = createCanvasPropertySessionController()
    const commitPatches = vi.fn()
    const previewPatch = createPatchSet('node-1', { borderWidth: 2 })
    const commitPatch = createPatchSet('node-1', { borderWidth: 8 })
    const patches = [previewPatch, commitPatch]

    controller.startPropertySession({
      collectPatches: (applyChange) => {
        applyChange()
        return patches.shift() ?? commitPatch
      },
      previewPatches: () => undefined,
      commitPatches,
    })
    controller.updatePropertyPreview(() => undefined)
    controller.commitPropertySession(() => undefined)

    expect(commitPatches).toHaveBeenCalledWith(commitPatch)
  })

  it('cancel drops the active preview without committing', () => {
    const controller = createCanvasPropertySessionController()
    const commitPatches = vi.fn()

    controller.startPropertySession({
      collectPatches: () => createPatchSet('node-1', { borderWidth: 2 }),
      previewPatches: () => undefined,
      commitPatches,
    })
    controller.updatePropertyPreview(() => undefined)
    controller.cancelPropertySession()
    controller.commitPropertySession()

    expect(commitPatches).not.toHaveBeenCalled()
  })
})

function createPatchSet(nodeId: string, data: Record<string, unknown>): CanvasPropertyPatchSet {
  return {
    nodeDataPatches: new Map([[nodeId, data]]),
    edgePatches: new Map(),
  }
}
