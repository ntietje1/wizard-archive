import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'

const repoRoot = process.cwd()

describe('canvas architecture boundaries', () => {
  it('keeps main editor entry points on the canvas-owned runtime and scene', () => {
    const viewer = readRepoFile('src/features/canvas/components/canvas-viewer.tsx')
    const runtime = readRepoFile('src/features/canvas/runtime/use-canvas-editor-runtime.ts')
    const coreRuntime = readRepoFile('src/features/canvas/runtime/use-canvas-core-runtime.ts')

    expect(viewer).toContain('useCanvasEditorRuntime')
    expect(viewer).toContain('CanvasScene')
    expect(runtime).toContain('useCanvasCoreRuntime')
    expect(runtime).not.toContain('createCanvasEngine')
    expect(runtime).not.toContain('createCanvasViewportController')
    expect(coreRuntime).toContain('createCanvasEngine')
    expect(coreRuntime).toContain('createCanvasViewportController')
  })

  it('keeps connection handle rendering independent from external graph components', () => {
    const connectionHandles = readRepoFile(
      'src/features/canvas/nodes/shared/canvas-node-connection-handles.tsx',
    )

    expect(connectionHandles).not.toContain('useConnection')
  })

  it('keeps the canvas slice on the native canvas engine and renderer contracts', () => {
    const canvasFiles = listFiles(join(repoRoot, 'src/features/canvas')).filter(
      (file) =>
        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
        !file.includes(`${pathSeparator}__tests__${pathSeparator}`),
    )

    expect(canvasFiles.length).toBeGreaterThan(0)

    for (const file of canvasFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toContain('CanvasNodeData = Record<string, unknown>')
      expect(source).not.toContain('CanvasNodeComponentProps<any>')
    }
  })

  it('keeps pure canvas system modules independent from external graph imports', () => {
    const systemFiles = listFiles(join(repoRoot, 'src/features/canvas/system')).filter(
      (file) => !file.includes(`${pathSeparator}__tests__${pathSeparator}`),
    )

    for (const file of systemFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toContain('~/features/canvas/components')
      expect(source).not.toContain('~/features/canvas/runtime')
      expect(source).not.toMatch(/(?:\.\.\/)+runtime\//)
    }
  })

  it('keeps node shell ownership in CanvasNodeWrapper, not inner node frame', () => {
    const wrapper = readRepoFile('src/features/canvas/components/canvas-node-wrapper.tsx')
    const frame = readRepoFile('src/features/canvas/nodes/shared/canvas-node-frame.tsx')
    const router = readRepoFile('src/features/canvas/runtime/interaction/canvas-pointer-router.ts')

    expect(wrapper).toContain('registerNodeElement')
    expect(wrapper).not.toContain('nodeDragController')
    expect(router).toContain("kind: 'node-drag'")
    expect(router).toContain('nodeDragController')
    expect(router).toMatch(/\.begin\(\s*target\.nodeId,\s*event\s*\)/)
    expect(frame).not.toContain('registerNodeElement')
    expect(frame).not.toContain('nodeDragController')
  })

  it('keeps engine edge patches narrowed to persisted canvas edge fields', () => {
    const validPatch: CanvasEdgePatch = {
      type: 'step',
      style: { stroke: '#000', strokeWidth: 3, opacity: 0.75 },
    }
    void validPatch

    // @ts-expect-error Canvas edge patches must not rewrite graph endpoints.
    const invalidPatch: CanvasEdgePatch = { source: 'node-2' }
    void invalidPatch

    const engineTypes = readRepoFile('src/features/canvas/system/canvas-engine-types.ts')
    expect(engineTypes).toContain(
      'patchEdges: (updates: ReadonlyMap<string, CanvasEdgePatch>) => void',
    )
    expect(engineTypes).not.toContain('patchEdges: (updates: ReadonlyMap<string, Partial<Edge>>)')
  })

  it('keeps DOM registration and render scheduling out of the engine public API', () => {
    const engineTypes = readRepoFile('src/features/canvas/system/canvas-engine-types.ts')
    const runtime = readRepoFile('src/features/canvas/runtime/providers/canvas-runtime.ts')

    expect(engineTypes).not.toContain('registerViewportElement')
    expect(engineTypes).not.toContain('scheduleNodeDataPatches')
    expect(engineTypes).not.toContain('flushRenderScheduler')
    expect(runtime).toContain('CanvasDomRuntimeContext')
    expect(runtime).not.toContain('CanvasDocumentServicesContext')
    expect(runtime).not.toContain('CanvasInteractionServicesContext')
    expect(runtime).not.toContain('CanvasPresenceServicesContext')
    expect(runtime).toContain('useCanvasDocumentWriter')
    expect(runtime).toContain('useCanvasViewportController')
    expect(runtime).not.toContain('interface CanvasRuntime')
    expect(runtime).not.toContain('READ_ONLY_CANVAS_RUNTIME')
  })

  it('keeps empty context-menu extension points out of node and edge specs', () => {
    const nodeModules = readRepoFile('src/features/canvas/nodes/canvas-node-modules.ts')
    const edgeRegistry = readRepoFile('src/features/canvas/edges/canvas-edge-registry.tsx')

    expect(nodeModules).not.toContain('EMPTY_CONTEXT_MENU_CONTRIBUTORS')
    expect(edgeRegistry).not.toContain('contextMenuContributors: EMPTY_CONTEXT_MENU_CONTRIBUTORS')
  })

  it('keeps read-only preview rendering out of fake editor runtime services', () => {
    const preview = readRepoFile('src/features/canvas/components/canvas-read-only-preview.tsx')

    expect(preview).toContain('CanvasSceneViewport')
    expect(preview).not.toContain('createReadOnlyPreviewServices')
    expect(preview).not.toContain('CanvasRuntimeProvider')
    expect(preview).not.toMatch(/\bdocumentWriter\s*:/)
  })
})

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

const pathSeparator = /\\/.test(join('a', 'b')) ? '\\' : '/'

function listFiles(directory: string): Array<string> {
  const files: Array<string> = []

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      files.push(...listFiles(path))
    } else {
      files.push(path)
    }
  }

  return files
}
