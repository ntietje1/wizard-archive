import { createElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { ResourceShell } from './resources/resource-shell'
import type { ResourceShellSort } from './resources/resource-shell'
import type { WizardEditorRuntime } from './resources/editor-runtime-contract'
import type { ResourceId } from './resources/domain-id'

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
  runtime: WizardEditorRuntime
  sidebar?: 'fixed' | 'none' | 'resizable'
  sidebarSlots?: {
    bottomPanel?: ReactNode
    railEndControls?: ReactNode
    railStartControls?: ReactNode
  }
  sidebarSort?: ResourceShellSort
  workspaceName: string | null
}

export interface WizardEditorViewStateStores {
  canvasViewport: {
    loadCanvasViewport: (canvasId: ResourceId) => WizardEditorCanvasViewport
    saveCanvasViewport: (canvasId: ResourceId, viewport: WizardEditorCanvasViewport) => void
  }
  mapTransform: {
    loadMapTransform: (mapId: ResourceId) => WizardEditorMapTransform
    saveMapTransform: (mapId: ResourceId, value: WizardEditorMapTransform) => void
  }
  noteScroll: {
    loadNoteScrollTop: (noteId: ResourceId) => number
    saveNoteScrollTop: (noteId: ResourceId, scrollTop: number) => void
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
  return createElement(ResourceShell, {
    ariaLabel: props.ariaLabel,
    runtime: props.runtime,
    sidebarSlots: props.sidebarSlots,
    showSidebar: props.sidebar !== 'none',
    sort: props.sidebarSort,
    workspaceName: props.workspaceName,
  })
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
  itemId: ResourceId,
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
  itemId: ResourceId,
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

function getViewStateStorageKey(keyPrefix: string, namespace: string, itemId: ResourceId): string {
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
