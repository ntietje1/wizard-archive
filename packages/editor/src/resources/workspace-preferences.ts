export type WorkspaceSort = Readonly<{
  by: 'created' | 'title' | 'updated'
  direction: 'ascending' | 'descending'
}>

export type WorkspacePreferences = Readonly<{
  mode: 'editor' | 'viewer'
  sort: WorkspaceSort
  panels: Readonly<{
    leftVisible: boolean
    rightVisible: boolean
  }>
}>

export type WorkspacePreferencePatch =
  | Readonly<{ field: 'mode'; value: WorkspacePreferences['mode'] }>
  | Readonly<{ field: 'sort'; value: WorkspaceSort }>
  | Readonly<{ field: 'leftPanelVisible'; value: boolean }>
  | Readonly<{ field: 'rightPanelVisible'; value: boolean }>

export type WorkspacePreferencesState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; value: WorkspacePreferences }>
  | Readonly<{
      status: 'unavailable'
      reason: 'scope_unavailable' | 'unauthorized'
    }>

export interface WorkspacePreferencesSource {
  get(): WorkspacePreferencesState
  subscribe(listener: () => void): () => void
  patch(patch: WorkspacePreferencePatch): Promise<void>
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  mode: 'editor',
  sort: { by: 'title', direction: 'ascending' },
  panels: {
    leftVisible: true,
    rightVisible: false,
  },
}

export function applyWorkspacePreferencePatch(
  preferences: WorkspacePreferences,
  patch: WorkspacePreferencePatch,
): WorkspacePreferences {
  switch (patch.field) {
    case 'mode':
      return { ...preferences, mode: patch.value }
    case 'sort':
      return { ...preferences, sort: patch.value }
    case 'leftPanelVisible':
      return { ...preferences, panels: { ...preferences.panels, leftVisible: patch.value } }
    case 'rightPanelVisible':
      return { ...preferences, panels: { ...preferences.panels, rightVisible: patch.value } }
  }
}

export function normalizeWorkspacePreferences(value: unknown): WorkspacePreferences {
  const preferences = isRecord(value) ? value : {}
  const sort = isRecord(preferences.sort) ? preferences.sort : {}
  const panels = isRecord(preferences.panels) ? preferences.panels : {}
  return {
    mode: preferences.mode === 'viewer' ? 'viewer' : 'editor',
    sort: {
      by: sort.by === 'created' || sort.by === 'updated' ? sort.by : 'title',
      direction: sort.direction === 'descending' ? 'descending' : 'ascending',
    },
    panels: {
      leftVisible: typeof panels.leftVisible === 'boolean' ? panels.leftVisible : true,
      rightVisible: typeof panels.rightVisible === 'boolean' ? panels.rightVisible : false,
    },
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
