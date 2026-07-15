export type WorkspaceSort = Readonly<{
  by: 'created' | 'title' | 'updated'
  direction: 'ascending' | 'descending'
}>

export type WorkspacePanelPreference = Readonly<{
  size: number
  visible: boolean
}>

export type WorkspacePreferences = Readonly<{
  mode: 'editor' | 'viewer'
  sort: WorkspaceSort
  panels: Readonly<{
    left: WorkspacePanelPreference
    right: WorkspacePanelPreference
  }>
}>

export type WorkspacePreferencesSnapshot = Readonly<{
  revision: number
  value: WorkspacePreferences
}>

export type WorkspacePreferenceChange =
  | Readonly<{ type: 'mode'; mode: WorkspacePreferences['mode'] }>
  | Readonly<{ type: 'sort'; sort: WorkspaceSort }>
  | Readonly<{
      type: 'panel'
      panel: keyof WorkspacePreferences['panels']
      size?: number
      visible?: boolean
    }>

export type WorkspacePreferencesState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{
      status: 'ready'
      snapshot: WorkspacePreferencesSnapshot
      pendingChanges: number
    }>
  | Readonly<{
      status: 'unavailable'
      reason: 'scope_unavailable' | 'unauthorized'
    }>

export type WorkspacePreferenceChangeResult =
  | Readonly<{ status: 'completed' }>
  | Readonly<{ status: 'failed'; retryable: boolean }>

export interface WorkspacePreferencesSource {
  get(): WorkspacePreferencesState
  subscribe(listener: () => void): () => void
  change(change: WorkspacePreferenceChange): Promise<WorkspacePreferenceChangeResult>
}

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  mode: 'editor',
  sort: { by: 'title', direction: 'ascending' },
  panels: {
    left: { size: 288, visible: true },
    right: { size: 280, visible: false },
  },
}

const MIN_WORKSPACE_PANEL_SIZE = 200
const MAX_WORKSPACE_PANEL_SIZE = 600

export function applyWorkspacePreferenceChange(
  preferences: WorkspacePreferences,
  change: WorkspacePreferenceChange,
): WorkspacePreferences {
  switch (change.type) {
    case 'mode':
      return { ...preferences, mode: change.mode }
    case 'sort':
      return { ...preferences, sort: change.sort }
    case 'panel': {
      const current = preferences.panels[change.panel]
      return {
        ...preferences,
        panels: {
          ...preferences.panels,
          [change.panel]: {
            size:
              change.size === undefined
                ? current.size
                : normalizeWorkspacePanelSize(change.size, current.size),
            visible: change.visible ?? current.visible,
          },
        },
      }
    }
  }
}

function normalizeWorkspacePanelSize(size: number, fallback: number): number {
  if (!Number.isFinite(size)) return fallback
  return Math.min(MAX_WORKSPACE_PANEL_SIZE, Math.max(MIN_WORKSPACE_PANEL_SIZE, Math.round(size)))
}

type WorkspacePreferencesPersistence = Readonly<{
  save(change: WorkspacePreferenceChange): Promise<WorkspacePreferencesSnapshot>
}>

type PendingChange = Readonly<{
  id: number
  change: WorkspacePreferenceChange
}>

export class WorkspacePreferencesController implements WorkspacePreferencesSource {
  readonly #listeners = new Set<() => void>()
  readonly #persistence: WorkspacePreferencesPersistence
  #authoritative: WorkspacePreferencesSnapshot | null = null
  #nextChangeId = 1
  #pending: Array<PendingChange> = []
  #state: WorkspacePreferencesState = { status: 'loading' }

  constructor(persistence: WorkspacePreferencesPersistence) {
    this.#persistence = persistence
  }

  get = () => this.#state

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  hydrate(snapshot: WorkspacePreferencesSnapshot) {
    if (this.#authoritative && snapshot.revision < this.#authoritative.revision) return
    this.#authoritative = snapshot
    this.#publish()
  }

  unavailable(reason: Extract<WorkspacePreferencesState, { status: 'unavailable' }>['reason']) {
    this.#authoritative = null
    this.#pending = []
    this.#state = { status: 'unavailable', reason }
    this.#notify()
  }

  change = async (change: WorkspacePreferenceChange): Promise<WorkspacePreferenceChangeResult> => {
    if (!this.#authoritative) return { status: 'failed', retryable: false }
    const pending = { id: this.#nextChangeId++, change }
    this.#pending.push(pending)
    this.#publish()

    try {
      const snapshot = await this.#persistence.save(change)
      this.#removePending(pending.id)
      if (!this.#authoritative || snapshot.revision >= this.#authoritative.revision) {
        this.#authoritative = snapshot
      }
      this.#publish()
      return { status: 'completed' }
    } catch {
      this.#removePending(pending.id)
      this.#publish()
      return { status: 'failed', retryable: true }
    }
  }

  #removePending(id: number) {
    this.#pending = this.#pending.filter((candidate) => candidate.id !== id)
  }

  #publish() {
    if (!this.#authoritative) return
    const value = this.#pending.reduce(
      (preferences, pending) => applyWorkspacePreferenceChange(preferences, pending.change),
      this.#authoritative.value,
    )
    this.#state = {
      status: 'ready',
      snapshot: { revision: this.#authoritative.revision, value },
      pendingChanges: this.#pending.length,
    }
    this.#notify()
  }

  #notify() {
    for (const listener of this.#listeners) listener()
  }
}
