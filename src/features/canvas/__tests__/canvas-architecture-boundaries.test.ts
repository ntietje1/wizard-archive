import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { CanvasEdgePatch } from '../edges/canvas-edge-types'

const repoRoot = process.cwd()

describe('canvas architecture boundaries', () => {
  it('keeps main editor entry points on the canvas-owned runtime and scene', () => {
    const viewer = readRepoFile('src/features/canvas/components/canvas-viewer.tsx')
    const runtime = readRepoFile('src/features/canvas/runtime/use-canvas-editor-runtime.ts')
    const runtimeCoreShell = readRepoFile(
      'src/features/canvas/runtime/use-canvas-editor-runtime-core.ts',
    )
    const runtimeBase = readRepoFile(
      'src/features/canvas/runtime/use-canvas-editor-runtime-base.ts',
    )
    const runtimeHost = readRepoFile(
      'src/features/canvas/components/canvas-editor-runtime-host.tsx',
    )
    const coreRuntime = readRepoFile('src/features/canvas/runtime/use-canvas-core-runtime.ts')
    const surface = readRepoFile('src/features/canvas/components/canvas-editor-surface.tsx')

    expect(viewer).toContain('useCanvasEditorRuntime')
    expect(viewer).toContain('CanvasEditorRuntimeHost')
    expect(runtimeHost).toContain('CanvasEditorSurface')
    expect(surface).toContain('CanvasScene')
    expect(runtime).toContain('useCanvasEditorRuntimeCore')
    expect(runtimeCoreShell).toContain('useCanvasEditorRuntimeBase')
    expect(runtime).not.toContain('createCanvasEngine')
    expect(runtime).not.toContain('createCanvasViewportController')
    expect(runtimeBase).toContain('useCanvasCoreRuntime')
    expect(runtimeBase).not.toContain('createCanvasEngine')
    expect(runtimeBase).not.toContain('createCanvasViewportController')
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
    expect(runtime).toContain('CanvasViewportRuntimeContext')
    expect(runtime).not.toContain('CanvasDocumentServicesContext')
    expect(runtime).not.toContain('CanvasInteractionServicesContext')
    expect(runtime).not.toContain('CanvasPresenceServicesContext')
    expect(runtime).toContain('useCanvasDocumentRuntime')
    expect(runtime).toContain('useCanvasViewportRuntime')
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

  it('keeps demo canvas on shared runtime assembly instead of a parallel editor implementation', () => {
    const demoWorkspace = readRepoFile('src/features/landing/components/demo-workspace.tsx')
    const localEditor = readRepoFile('src/features/canvas/components/local-canvas-editor.tsx')
    const runtimeCore = readRepoFile(
      'src/features/canvas/runtime/use-canvas-editor-runtime-core.ts',
    )
    const liveRuntime = readRepoFile('src/features/canvas/runtime/use-canvas-editor-runtime.ts')

    expect(demoWorkspace).toContain('~/features/canvas/components/local-canvas-editor')
    expect(demoWorkspace).not.toContain('~/features/landing/demo-workspace/local-canvas-editor')
    expect(localEditor).toContain('useCanvasEditorRuntimeCore')
    expect(localEditor).toContain('CanvasEditorRuntimeHost')
    expect(localEditor).toContain('EmbedNode')
    expect(localEditor).toContain('TextNode')
    expect(localEditor).toContain('StrokeNode')
    expect(localEditor).not.toContain('useCanvasEditorRuntimeBase')
    expect(localEditor).not.toContain('useCanvasEditorSceneRuntime')
    expect(localEditor).not.toContain('createCanvasToolRuntime')
    expect(localEditor).not.toContain('useCanvasContextMenuCore')
    expect(localEditor).not.toContain('CanvasPreviewDefaultEmbedNode')
    expect(localEditor).not.toContain('CanvasRuntimeProvider')
    expect(localEditor).not.toContain('CanvasEditorSurface')

    expect(runtimeCore).toContain('useCanvasEditorRuntimeBase')
    expect(runtimeCore).toContain('useCanvasToolRuntimeCore')
    expect(runtimeCore).not.toContain('useYjsPreviewUpload')
    expect(runtimeCore).not.toContain('useCanvasDropIntegration')
    expect(liveRuntime).toContain('useCanvasEditorRuntimeCore')
    expect(liveRuntime).toContain('useYjsPreviewUpload')
    expect(liveRuntime).toContain('useCanvasDropIntegration')
  })

  it('keeps canvas embed renderers behind explicit embed source resolution', () => {
    const embedNode = readRepoFile('src/features/canvas/nodes/embed/embed-node.tsx')
    const previewEmbedNode = readRepoFile(
      'src/features/canvas/components/canvas-preview-embed-node.tsx',
    )
    const embeddedCanvasContent = readRepoFile(
      'src/features/embeds/components/embedded-canvas-content.tsx',
    )
    const toolbarModel = readRepoFile('src/features/canvas/components/use-canvas-toolbar-model.ts')
    const liveEmbedResolver = readRepoFile(
      'src/features/embeds/components/live-sidebar-item-embed-resolver.tsx',
    )
    const embedContent = readRepoFile('src/features/embeds/components/embed-content.tsx')
    const embedSidebarItemResolution = readRepoFile(
      'src/features/embeds/context/embed-sidebar-item-resolution.ts',
    )
    const liveEmbeddedCanvasResolver = readRepoFile(
      'src/features/embeds/components/live-embedded-canvas-state-resolver.tsx',
    )
    const embeddedMapContent = readRepoFile(
      'src/features/embeds/components/embedded-map-content.tsx',
    )
    const liveEmbeddedMapResolver = readRepoFile(
      'src/features/embeds/components/live-embedded-map-state-resolver.tsx',
    )
    const editableEmbedControls = readRepoFile(
      'src/features/embeds/hooks/use-editable-embed-target-controls.ts',
    )
    const liveEmbedTargetOperations = readRepoFile(
      'src/features/embeds/components/live-embed-target-operations-provider.tsx',
    )

    for (const source of [
      embedNode,
      previewEmbedNode,
      embeddedCanvasContent,
      embeddedMapContent,
      toolbarModel,
    ]) {
      expect(source).not.toContain('useSidebarItemById')
      expect(source).not.toContain('useSidebarItemAvailabilityState')
      expect(source).not.toContain('useCampaignQuery')
      expect(source).not.toContain('convex/_generated/api')
    }

    expect(embedNode).toContain('useEmbedSidebarItemResolver')
    expect(previewEmbedNode).toContain('useEmbedSidebarItemResolver')
    expect(embeddedCanvasContent).toContain('useEmbeddedCanvasStateResolver')
    expect(embeddedCanvasContent).not.toMatch(/import\s+\{\s*useEmbeddedCanvasState\s*\}\s+from/)
    expect(embeddedMapContent).toContain('useEmbeddedMapStateResolver')
    expect(embeddedMapContent).not.toContain('useMapRenderPins')
    expect(embedContent).not.toContain('useSidebarItemAvailabilityState')
    expect(embedSidebarItemResolution).not.toContain('useSidebarItemAvailabilityState')
    expect(editableEmbedControls).toContain('useEmbedTargetOperations')
    expect(editableEmbedControls).not.toContain('useEmbedUpload')
    expect(liveEmbedResolver).toContain('useSidebarItemById')
    expect(liveEmbedResolver).toContain('useSidebarItemAvailabilityState')
    expect(liveEmbeddedCanvasResolver).toContain('useLiveEmbeddedCanvasState')
    expect(liveEmbeddedMapResolver).toContain('useMapRenderPins')
    expect(liveEmbedTargetOperations).toContain('useEmbedUpload')
  })

  it('keeps the canvas embed node shell independent from concrete sidebar item presentations', () => {
    const embedNode = readRepoFile('src/features/canvas/nodes/embed/embed-node.tsx')
    const canvasSidebarItemEmbedRenderer = readRepoFile(
      'src/features/embeds/components/canvas-sidebar-item-embed-renderer.tsx',
    )

    expect(embedNode).toContain('CanvasSidebarItemEmbedRenderer')
    expect(embedNode).toContain('isCanvasSidebarItemEmbedRichTextEditable')
    expect(embedNode).not.toContain('SIDEBAR_ITEM_TYPES')
    expect(embedNode).not.toContain('EmbedNoteContent')
    expect(embedNode).not.toContain('EmbeddedCanvasContent')
    expect(embedNode).not.toContain('EmbeddedMapContent')
    expect(embedNode).not.toContain('FileMediaEmbedContent')
    expect(embedNode).not.toContain('SidebarItemPreviewContent')

    expect(canvasSidebarItemEmbedRenderer).not.toContain('useCanvasDocumentRuntime')
    expect(canvasSidebarItemEmbedRenderer).not.toContain('useCanvasEngine')
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
