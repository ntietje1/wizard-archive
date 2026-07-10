import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { WorkspaceRuntimeHost } from './workspace/runtime-host'
import type { SortOptions } from './workspace/items-persistence-contract'
import type {
  WizardEditorCanvasSessionPorts,
  WizardEditorDocumentSource,
  WizardEditorRuntime,
} from './adapter'

type WizardEditorResourceId = string

export interface WizardEditorCanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface WizardEditorMapTransform {
  scale: number
  positionX: number
  positionY: number
}

export interface WizardEditorProps {
  ariaLabel: string
  noteHeadingRequest?: {
    heading?: string | null
    onConsumed?: () => void
  }
  panelPreferences?: {
    appliedPanelPreferences: Record<string, { size: number | null; visible: boolean | null }> | null
    initialPanelPreferences: Record<string, { size: number | null; visible: boolean | null }> | null
    isLoaded: boolean
    onPanelPreferenceChange?: (preference: {
      panelId: string
      size: number
      visible: boolean
    }) => void
  }
  runtime: WizardEditorRuntime
  sidebar?: 'fixed' | 'none' | 'resizable'
  sidebarSlots?: {
    bottomPanel?: ReactNode
    railEndControls?: ReactNode
    railStartControls?: ReactNode
  }
  sidebarSort?: {
    options: SortOptions
    setOptions: (options: SortOptions) => void
  }
  viewStateStores: WizardEditorViewStateStores
  workspaceName: string | null
}

export interface WizardEditorViewStateStores {
  canvasViewport: {
    loadCanvasViewport: (canvasId: WizardEditorResourceId) => WizardEditorCanvasViewport
    saveCanvasViewport: (
      canvasId: WizardEditorResourceId,
      viewport: WizardEditorCanvasViewport,
    ) => void
  }
  mapTransform: {
    loadMapTransform: (mapId: WizardEditorResourceId) => WizardEditorMapTransform
    saveMapTransform: (mapId: WizardEditorResourceId, value: WizardEditorMapTransform) => void
  }
  noteScroll: {
    loadNoteScrollTop: (noteId: WizardEditorResourceId) => number
    saveNoteScrollTop: (noteId: WizardEditorResourceId, scrollTop: number) => void
  }
}

const WORKSPACE_VIEW_STATE_STORAGE = {
  canvasViewport: {
    createDefaultValue: () => ({ x: 0, y: 0, zoom: 1 }),
    keyPrefix: 'canvas-viewport',
    parse: parseCanvasViewport,
  },
  mapTransform: {
    createDefaultValue: () => ({ scale: 1, positionX: 0, positionY: 0 }),
    keyPrefix: 'map-transform',
    parse: parseMapTransform,
  },
  noteScroll: {
    createDefaultValue: () => 0,
    keyPrefix: 'note-scroll',
    parse: parseNoteScrollTop,
  },
} as const

export function WizardEditor(props: WizardEditorProps): ReactElement {
  return createElement(WorkspaceRuntimeHost, {
    ...props,
    runtime: toWorkspaceRuntime(props.runtime),
  })
}

type InternalHostProps = Parameters<typeof WorkspaceRuntimeHost>[0]
type InternalRuntime = InternalHostProps['runtime']
type WizardEditorInternalDocumentSource = InternalRuntime['sessions']

function toWorkspaceRuntime(runtime: WizardEditorRuntime): InternalRuntime {
  return {
    workspace: runtime.workspace,
    filesystem: {
      ...runtime.resources,
      operations: runtime.commands.operations,
      search: runtime.search.items,
      download: runtime.io.download,
      history: runtime.history,
      sharing: runtime.sharing,
    },
    navigation: runtime.navigation as InternalRuntime['navigation'],
    sessions: toInternalWizardEditorDocumentSource(runtime.sessions),
  }
}

function toInternalWizardEditorDocumentSource(
  source: WizardEditorDocumentSource,
): WizardEditorInternalDocumentSource {
  return {
    ...source,
    canvas: toInternalCanvasSessionPorts(source.canvas),
  }
}

function toInternalCanvasSessionPorts(
  source: WizardEditorCanvasSessionPorts,
): WizardEditorInternalDocumentSource['canvas'] {
  return {
    document: {
      useCanvasDocumentSession: (canvas) => source.document.useCanvasDocumentSession(canvas),
    },
  }
}

export function createBrowserWizardEditorViewStateStores({
  namespace,
}: {
  namespace: string
}): WizardEditorViewStateStores {
  return {
    canvasViewport: {
      loadCanvasViewport: (canvasId) =>
        loadBrowserViewState(WORKSPACE_VIEW_STATE_STORAGE.canvasViewport, namespace, canvasId),
      saveCanvasViewport: (canvasId, value) =>
        saveBrowserViewState(
          WORKSPACE_VIEW_STATE_STORAGE.canvasViewport.keyPrefix,
          namespace,
          canvasId,
          value,
        ),
    },
    mapTransform: {
      loadMapTransform: (mapId) =>
        loadBrowserViewState(WORKSPACE_VIEW_STATE_STORAGE.mapTransform, namespace, mapId),
      saveMapTransform: (mapId, value) =>
        saveBrowserViewState(
          WORKSPACE_VIEW_STATE_STORAGE.mapTransform.keyPrefix,
          namespace,
          mapId,
          value,
        ),
    },
    noteScroll: {
      loadNoteScrollTop: (noteId) =>
        loadBrowserViewState(WORKSPACE_VIEW_STATE_STORAGE.noteScroll, namespace, noteId),
      saveNoteScrollTop: (noteId, scrollTop) =>
        saveBrowserViewState(
          WORKSPACE_VIEW_STATE_STORAGE.noteScroll.keyPrefix,
          namespace,
          noteId,
          scrollTop,
        ),
    },
  }
}

function loadBrowserViewState<TValue>(
  storage: {
    createDefaultValue: () => TValue
    keyPrefix: string
    parse: (value: unknown) => TValue | null
  },
  namespace: string,
  itemId: WizardEditorResourceId,
): TValue {
  if (typeof window === 'undefined') return storage.createDefaultValue()

  try {
    const stored = window.localStorage.getItem(
      getViewStateStorageKey(storage.keyPrefix, namespace, itemId),
    )
    if (!stored) return storage.createDefaultValue()
    return storage.parse(JSON.parse(stored)) ?? storage.createDefaultValue()
  } catch {
    return storage.createDefaultValue()
  }
}

function saveBrowserViewState<TValue>(
  keyPrefix: string,
  namespace: string,
  itemId: WizardEditorResourceId,
  value: TValue,
) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      getViewStateStorageKey(keyPrefix, namespace, itemId),
      JSON.stringify(value),
    )
  } catch (error) {
    console.debug('Failed to save WizardEditor view state', {
      error,
      itemId,
      keyPrefix,
      namespace,
    })
    return
  }
}

function getViewStateStorageKey(
  keyPrefix: string,
  namespace: string,
  itemId: WizardEditorResourceId,
): string {
  return `wizard-editor-view-state:${encodeURIComponent(namespace)}:${keyPrefix}:${encodeURIComponent(
    String(itemId),
  )}`
}

function parseCanvasViewport(value: unknown) {
  return parseFiniteNumberFields(value, ['x', 'y', 'zoom'] as const)
}

function parseMapTransform(value: unknown) {
  return parseFiniteNumberFields(value, ['scale', 'positionX', 'positionY'] as const)
}

function parseFiniteNumberFields<TField extends string>(
  value: unknown,
  fields: ReadonlyArray<TField>,
): Record<TField, number> | null {
  if (typeof value !== 'object' || value === null) return null

  const source = value as Record<string, unknown>
  const result = {} as Record<TField, number>
  for (const field of fields) {
    const fieldValue = source[field]
    if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) return null
    result[field] = fieldValue
  }
  return result
}

function parseNoteScrollTop(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
