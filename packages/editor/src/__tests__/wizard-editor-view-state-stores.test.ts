import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBrowserWizardEditorViewStateStores } from '@wizard-archive/editor'

describe('browser WizardEditor view state stores', () => {
  let storage: Record<string, string>
  const namespace = 'workspace-1'

  beforeEach(() => {
    storage = {}
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => storage[key] ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      storage[key] = value
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads and saves canvas viewports through browser storage', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })

    viewStateStores.canvasViewport.saveCanvasViewport('canvas-1' as never, {
      x: 64,
      y: -32,
      zoom: 2,
    })

    expect(storage['wizard-editor-view-state:workspace-1:canvas-viewport:canvas-1']).toBe(
      JSON.stringify({ x: 64, y: -32, zoom: 2 }),
    )
    expect(viewStateStores.canvasViewport.loadCanvasViewport('canvas-1' as never)).toEqual({
      x: 64,
      y: -32,
      zoom: 2,
    })
  })

  it('isolates browser storage by workspace namespace', () => {
    const firstWorkspaceStores = createBrowserWizardEditorViewStateStores({
      namespace: 'workspace-a',
    })
    const secondWorkspaceStores = createBrowserWizardEditorViewStateStores({
      namespace: 'workspace-b',
    })

    firstWorkspaceStores.canvasViewport.saveCanvasViewport('shared-canvas' as never, {
      x: 64,
      y: -32,
      zoom: 2,
    })

    expect(
      secondWorkspaceStores.canvasViewport.loadCanvasViewport('shared-canvas' as never),
    ).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })
  })

  it('loads and saves map transforms through browser storage', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })

    viewStateStores.mapTransform.saveMapTransform('map-1' as never, {
      scale: 1.5,
      positionX: 24,
      positionY: -12,
    })

    expect(storage['wizard-editor-view-state:workspace-1:map-transform:map-1']).toBe(
      JSON.stringify({ scale: 1.5, positionX: 24, positionY: -12 }),
    )
    expect(viewStateStores.mapTransform.loadMapTransform('map-1' as never)).toEqual({
      scale: 1.5,
      positionX: 24,
      positionY: -12,
    })
  })

  it('uses editor domain defaults for invalid browser storage', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })
    storage['wizard-editor-view-state:workspace-1:canvas-viewport:canvas-1'] = '{"x":"bad"}'
    storage['wizard-editor-view-state:workspace-1:map-transform:map-1'] = '{"scale":"bad"}'
    storage['wizard-editor-view-state:workspace-1:note-scroll:note-1'] = '"bad"'

    expect(viewStateStores.canvasViewport.loadCanvasViewport('canvas-1' as never)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })
    expect(viewStateStores.mapTransform.loadMapTransform('map-1' as never)).toEqual({
      scale: 1,
      positionX: 0,
      positionY: 0,
    })
    expect(viewStateStores.noteScroll.loadNoteScrollTop('note-1' as never)).toBe(0)
  })

  it('returns isolated object defaults for browser view state', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })
    const canvasViewport = viewStateStores.canvasViewport.loadCanvasViewport('canvas-1' as never)
    canvasViewport.x = 42

    expect(viewStateStores.canvasViewport.loadCanvasViewport('canvas-1' as never)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })

    const mapTransform = viewStateStores.mapTransform.loadMapTransform('map-1' as never)
    mapTransform.positionX = 42

    expect(viewStateStores.mapTransform.loadMapTransform('map-1' as never)).toEqual({
      scale: 1,
      positionX: 0,
      positionY: 0,
    })
  })

  it('loads and saves note scroll positions through browser storage', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })

    viewStateStores.noteScroll.saveNoteScrollTop('note-1' as never, 240)

    expect(storage['wizard-editor-view-state:workspace-1:note-scroll:note-1']).toBe('240')
    expect(viewStateStores.noteScroll.loadNoteScrollTop('note-1' as never)).toBe(240)
  })

  it('uses the default note scroll position for non-finite stored numbers', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })
    storage['wizard-editor-view-state:workspace-1:note-scroll:note-1'] = '1e999'

    expect(viewStateStores.noteScroll.loadNoteScrollTop('note-1' as never)).toBe(0)
  })

  it('uses defaults outside browser contexts', () => {
    const viewStateStores = createBrowserWizardEditorViewStateStores({ namespace })
    vi.stubGlobal('window', undefined)

    expect(viewStateStores.canvasViewport.loadCanvasViewport('canvas-1' as never)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })
    expect(() =>
      viewStateStores.canvasViewport.saveCanvasViewport('canvas-1' as never, {
        x: 64,
        y: -32,
        zoom: 2,
      }),
    ).not.toThrow()
  })
})
