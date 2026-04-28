import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'

const repoRoot = process.cwd()

describe('canvas architecture boundaries', () => {
  it('keeps main editor entry points on the canvas-owned runtime and scene', () => {
    const viewer = readRepoFile('src/features/canvas/components/canvas-viewer.tsx')
    const runtime = readRepoFile('src/features/canvas/runtime/use-canvas-editor-runtime.ts')

    expect(viewer).toContain('useCanvasEditorRuntime')
    expect(viewer).toContain('CanvasScene')
    expect(runtime).toContain('createCanvasEngine')
    expect(runtime).toContain('createCanvasViewportController')
  })

  it('keeps connection handle rendering independent from external graph components', () => {
    const connectionHandles = readRepoFile(
      'src/features/canvas/nodes/shared/canvas-node-connection-handles.tsx',
    )

    expect(connectionHandles).not.toContain('useConnection')
  })

  it('keeps the canvas slice free of React Flow and xyflow compatibility contracts', () => {
    const canvasFiles = listFiles(join(repoRoot, 'src/features/canvas')).filter(
      (file) =>
        (file.endsWith('.ts') || file.endsWith('.tsx')) &&
        !file.includes(`${pathSeparator}__tests__${pathSeparator}`),
    )

    expect(canvasFiles.length).toBeGreaterThan(0)

    for (const file of canvasFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/xyflow|reactflow|ReactFlow|react-flow/)
      expect(source).not.toContain('CanvasNodeData = Record<string, unknown>')
      expect(source).not.toContain('XYPosition')
      expect(source).not.toContain('CanvasNodeComponentProps<any>')
      expect(source).not.toContain('CanvasEdgeRendererProps<Record<string, unknown>')
    }
  })

  it('keeps pure canvas system modules independent from external graph imports', () => {
    const systemFiles = listFiles(join(repoRoot, 'src/features/canvas/system')).filter(
      (file) => !file.includes(`${pathSeparator}__tests__${pathSeparator}`),
    )

    for (const file of systemFiles) {
      expect(readFileSync(file, 'utf8')).not.toContain('~/features/canvas/components')
    }
  })

  it('keeps node shell ownership in CanvasNodeWrapper, not inner node frame', () => {
    const wrapper = readRepoFile('src/features/canvas/components/canvas-node-wrapper.tsx')
    const frame = readRepoFile('src/features/canvas/nodes/shared/canvas-node-frame.tsx')

    expect(wrapper).toContain('registerNodeElement')
    expect(wrapper).toContain('nodeDragController.handlePointerDown')
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
