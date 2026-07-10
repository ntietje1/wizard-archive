import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

describe('canvas runtime assembly', () => {
  it('assembles core runtime services without a separate base pass-through hook', () => {
    const coreSource = readRuntimeSource('use-canvas-editor-runtime-core.ts')

    expect(coreSource).not.toContain('useCanvasEditorRuntimeBase')
    expect(runtimeSourceExists('use-canvas-editor-runtime-base.ts')).toBe(false)
  })

  it('exposes canvas runtime hooks through one provider context', () => {
    const providerSource = readRuntimeSource(join('providers', 'canvas-runtime.ts'))

    expect(providerSource).toContain('const CanvasRuntimeContext = createContext')
    expect(providerSource).not.toContain('CanvasDocumentRuntimeContext')
    expect(providerSource).not.toContain('CanvasInteractionRuntimeContext')
    expect(providerSource).not.toContain('CanvasViewportRuntimeContext')
    expect(providerSource).not.toContain('CanvasToolRuntimeContext')
    expect(providerSource).not.toContain('CanvasToolLocalOverlayRuntimeContext')
    expect(providerSource).not.toContain('CanvasCollaborationRuntimeContext')
  })

  it('keeps the tool-facing runtime factory out of runtime adapter modules', () => {
    expect(runtimeSourceExists('canvas-tool-runtime-adapter.ts')).toBe(false)
  })

  it('assembles scene runtime behavior in the core runtime without a scene pass-through hook', () => {
    const coreSource = readRuntimeSource('use-canvas-editor-runtime-core.ts')

    expect(coreSource).not.toContain('useCanvasEditorSceneRuntime')
    expect(runtimeSourceExists('use-canvas-editor-scene-runtime.ts')).toBe(false)
  })
})

function readRuntimeSource(fileName: string) {
  return readFileSync(join(process.cwd(), 'packages/editor/src/canvas/runtime', fileName), 'utf8')
}

function runtimeSourceExists(fileName: string) {
  return existsSync(join(process.cwd(), 'packages/editor/src/canvas/runtime', fileName))
}
