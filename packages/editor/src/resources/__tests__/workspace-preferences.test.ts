import { describe, expect, it } from 'vite-plus/test'
import {
  applyWorkspacePreferenceChange,
  DEFAULT_WORKSPACE_PREFERENCES,
  WorkspacePreferencesController,
} from '../workspace-preferences'
import type {
  WorkspacePreferenceChange,
  WorkspacePreferencesSnapshot,
} from '../workspace-preferences'

describe('WorkspacePreferencesController', () => {
  it('keeps a newer optimistic preference when an older save fails', async () => {
    const saves: Array<ReturnType<typeof deferred<WorkspacePreferencesSnapshot>>> = []
    const controller = new WorkspacePreferencesController({
      save: () => {
        const save = deferred<WorkspacePreferencesSnapshot>()
        saves.push(save)
        return save.promise
      },
    })
    controller.hydrate({ revision: 0, value: DEFAULT_WORKSPACE_PREFERENCES })

    const first = controller.change({ type: 'panel', panel: 'left', size: 320 })
    const secondChange: WorkspacePreferenceChange = {
      type: 'panel',
      panel: 'left',
      size: 420,
    }
    const second = controller.change(secondChange)

    expect(readyValue(controller).panels.left.size).toBe(420)
    saves[0]!.reject(new Error('first save failed'))
    await first
    expect(readyValue(controller).panels.left.size).toBe(420)

    const savedValue = applyWorkspacePreferenceChange(DEFAULT_WORKSPACE_PREFERENCES, secondChange)
    saves[1]!.resolve({ revision: 1, value: savedValue })
    await second

    expect(controller.get()).toEqual({
      status: 'ready',
      snapshot: { revision: 1, value: savedValue },
      pendingChanges: 0,
    })
  })

  it('ignores hydration older than the latest authoritative revision', () => {
    const controller = new WorkspacePreferencesController({
      save: () => Promise.reject(new Error('unused')),
    })
    const current = {
      revision: 2,
      value: { ...DEFAULT_WORKSPACE_PREFERENCES, mode: 'viewer' as const },
    }
    controller.hydrate(current)
    controller.hydrate({ revision: 1, value: DEFAULT_WORKSPACE_PREFERENCES })

    expect(controller.get()).toMatchObject({ status: 'ready', snapshot: current })
  })
})

function readyValue(controller: WorkspacePreferencesController) {
  const state = controller.get()
  if (state.status !== 'ready') throw new Error('Expected ready preferences')
  return state.snapshot.value
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, reject, resolve }
}
