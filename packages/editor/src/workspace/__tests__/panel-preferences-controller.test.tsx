import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { EDITOR_WORKSPACE_PANEL_DEFINITIONS } from '../panel-definitions'
import { WorkspacePanelPreferencesController } from '../panel-preferences-controller'
import type { WorkspaceRuntimeHostPanelPreferencesSource } from '../runtime-host'
import { usePanelPreference } from '@wizard-archive/ui/panel-preferences/use-panel-preference'
import {
  usePanelPreferenceStore,
  usePanelPreferenceStoreApi,
} from '@wizard-archive/ui/panel-preferences/store'
import type { PanelPreferenceStoreApi } from '@wizard-archive/ui/panel-preferences/store'

const [EDITOR_LEFT_SIDEBAR_PANEL, EDITOR_RIGHT_SIDEBAR_PANEL] = EDITOR_WORKSPACE_PANEL_DEFINITIONS
const LEFT_SIDEBAR_PANEL_ID = EDITOR_LEFT_SIDEBAR_PANEL.panelId
const LEFT_SIDEBAR_DEFAULTS = EDITOR_LEFT_SIDEBAR_PANEL.defaults
const RIGHT_SIDEBAR_PANEL_ID = EDITOR_RIGHT_SIDEBAR_PANEL.panelId

describe('WorkspacePanelPreferencesController', () => {
  beforeEach(() => {
    usePanelPreferenceStore.setState({ panels: {}, isLoaded: false })
  })

  it('initializes known workspace panels from source-prefetched preferences', async () => {
    const storeRef = createPanelPreferenceStoreRef()

    render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          initialPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 31, visible: false },
            [RIGHT_SIDEBAR_PANEL_ID]: { size: 28, visible: true },
          },
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 31,
        visible: false,
      })
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[RIGHT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 28,
        visible: true,
      })
    })
  })

  it('exposes source-prefetched panel preferences on the first render', () => {
    const renderedPanels: Array<{ size: number; visible: boolean }> = []

    render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          initialPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 31, visible: false },
          },
        })}
      >
        <PanelPreferenceProbe renderedPanels={renderedPanels} />
      </WorkspacePanelPreferencesController>,
    )

    expect(renderedPanels[0]).toEqual({ size: 31, visible: false })
  })

  it('updates panels when source-prefetched preferences change', async () => {
    const storeRef = createPanelPreferenceStoreRef()
    const { rerender } = render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          initialPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 31, visible: false },
          },
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 31,
        visible: false,
      })
    })

    rerender(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          initialPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 35, visible: true },
          },
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 35,
        visible: true,
      })
    })
  })

  it('reconciles loaded source preferences without touching non-workspace panels', async () => {
    const storeRef = createPanelPreferenceStoreRef()

    render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          appliedPanelPreferences: {
            [RIGHT_SIDEBAR_PANEL_ID]: { size: 38, visible: false },
          },
          isLoaded: true,
        })}
      >
        <PanelPreferenceStoreProbe
          onStoreReady={(store) => {
            store.setState({
              isLoaded: false,
              panels: {
                [RIGHT_SIDEBAR_PANEL_ID]: {
                  size: 20,
                  visible: true,
                },
                'other-panel': {
                  size: 16,
                  visible: true,
                },
              },
            })
          }}
          storeRef={storeRef}
        />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(getPanelPreferenceStore(storeRef).getState().isLoaded).toBe(true)
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[RIGHT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 38,
        visible: false,
      })
      expect(getPanelPreferenceStore(storeRef).getState().panels['other-panel']).toMatchObject({
        size: 16,
        visible: true,
      })
    })
  })

  it('persists local panel changes after source hydration', async () => {
    const onPanelPreferenceChange = vi.fn()
    const storeRef = createPanelPreferenceStoreRef()

    render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 22, visible: false },
          },
          isLoaded: true,
          onPanelPreferenceChange,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(getPanelPreferenceStore(storeRef).getState().isLoaded).toBe(true)
    })

    onPanelPreferenceChange.mockClear()

    getPanelPreferenceStore(storeRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)

    expect(onPanelPreferenceChange).toHaveBeenCalledWith({
      panelId: LEFT_SIDEBAR_PANEL_ID,
      size: 22,
      visible: true,
    })
  })

  it('rolls back the latest local panel change when persistence rejects it', async () => {
    const save = deferred<void>()
    const storeRef = createPanelPreferenceStoreRef()

    render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 22, visible: false },
          },
          isLoaded: true,
          onPanelPreferenceChange: () => save.promise,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(getPanelPreferenceStore(storeRef).getState().isLoaded).toBe(true)
    })

    getPanelPreferenceStore(storeRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)
    save.reject(new Error('save failed'))

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID]?.visible,
      ).toBe(false)
    })
  })

  it('does not let a stale persistence failure roll back a newer panel change', async () => {
    const firstSave = deferred<void>()
    const secondSave = deferred<void>()
    const onPanelPreferenceChange = vi
      .fn()
      .mockImplementationOnce(() => firstSave.promise)
      .mockImplementationOnce(() => secondSave.promise)
    const storeRef = createPanelPreferenceStoreRef()

    render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 22, visible: false },
          },
          isLoaded: true,
          onPanelPreferenceChange,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(getPanelPreferenceStore(storeRef).getState().isLoaded).toBe(true)
    })

    getPanelPreferenceStore(storeRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)
    await waitFor(() => expect(onPanelPreferenceChange).toHaveBeenCalledTimes(1))
    getPanelPreferenceStore(storeRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, false)
    await waitFor(() => expect(onPanelPreferenceChange).toHaveBeenCalledTimes(2))

    secondSave.resolve()
    firstSave.reject(new Error('stale save failed'))

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID]?.visible,
      ).toBe(false)
    })
  })

  it('reapplies loaded source preferences after source-prefetched preferences change', async () => {
    const storeRef = createPanelPreferenceStoreRef()
    const { rerender } = render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          initialPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 31, visible: true },
          },
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 44, visible: false },
          },
          isLoaded: true,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 44,
        visible: false,
      })
    })

    getPanelPreferenceStore(storeRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)

    rerender(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          initialPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 35, visible: true },
          },
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 44, visible: false },
          },
          isLoaded: true,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 44,
        visible: false,
      })
    })
  })

  it('reapplies loaded source preferences when the loaded snapshot changes', async () => {
    const storeRef = createPanelPreferenceStoreRef()
    const { rerender } = render(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 44, visible: false },
          },
          isLoaded: true,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 44,
        visible: false,
      })
    })

    getPanelPreferenceStore(storeRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)

    rerender(
      <WorkspacePanelPreferencesController
        source={createPanelPreferencesSource({
          appliedPanelPreferences: {
            [LEFT_SIDEBAR_PANEL_ID]: { size: 52, visible: false },
          },
          isLoaded: true,
        })}
      >
        <PanelPreferenceStoreProbe storeRef={storeRef} />
      </WorkspacePanelPreferencesController>,
    )

    await waitFor(() => {
      expect(
        getPanelPreferenceStore(storeRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
      ).toMatchObject({
        size: 52,
        visible: false,
      })
    })
  })

  it('isolates fixed panel ids across concurrent runtime hosts', async () => {
    const firstStoreRef = createPanelPreferenceStoreRef()
    const secondStoreRef = createPanelPreferenceStoreRef()
    const firstChange = vi.fn()
    const secondChange = vi.fn()

    render(
      <>
        <WorkspacePanelPreferencesController
          source={createPanelPreferencesSource({
            appliedPanelPreferences: {
              [LEFT_SIDEBAR_PANEL_ID]: { size: 22, visible: false },
            },
            isLoaded: true,
            onPanelPreferenceChange: firstChange,
          })}
        >
          <PanelPreferenceStoreProbe storeRef={firstStoreRef} />
        </WorkspacePanelPreferencesController>
        <WorkspacePanelPreferencesController
          source={createPanelPreferencesSource({
            appliedPanelPreferences: {
              [LEFT_SIDEBAR_PANEL_ID]: { size: 34, visible: true },
            },
            isLoaded: true,
            onPanelPreferenceChange: secondChange,
          })}
        >
          <PanelPreferenceStoreProbe storeRef={secondStoreRef} />
        </WorkspacePanelPreferencesController>
      </>,
    )

    await waitFor(() => {
      expect(getPanelPreferenceStore(firstStoreRef).getState().isLoaded).toBe(true)
      expect(getPanelPreferenceStore(secondStoreRef).getState().isLoaded).toBe(true)
    })

    firstChange.mockClear()
    secondChange.mockClear()

    getPanelPreferenceStore(firstStoreRef).getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)

    expect(firstChange).toHaveBeenCalledWith({
      panelId: LEFT_SIDEBAR_PANEL_ID,
      size: 22,
      visible: true,
    })
    expect(secondChange).not.toHaveBeenCalled()
    expect(
      getPanelPreferenceStore(secondStoreRef).getState().panels[LEFT_SIDEBAR_PANEL_ID],
    ).toMatchObject({
      size: 34,
      visible: true,
    })
  })
})

function createPanelPreferenceStoreRef() {
  return { current: null as PanelPreferenceStoreApi | null }
}

function getPanelPreferenceStore(storeRef: { current: PanelPreferenceStoreApi | null }) {
  if (!storeRef.current) {
    throw new Error('Panel preference store was not captured')
  }
  return storeRef.current
}

function createPanelPreferencesSource(
  source: Partial<WorkspaceRuntimeHostPanelPreferencesSource>,
): WorkspaceRuntimeHostPanelPreferencesSource {
  return {
    appliedPanelPreferences: null,
    initialPanelPreferences: null,
    isLoaded: false,
    ...source,
  }
}

function PanelPreferenceProbe({
  renderedPanels,
}: {
  renderedPanels: Array<{ size: number; visible: boolean }>
}) {
  const panel = usePanelPreference(LEFT_SIDEBAR_PANEL_ID, LEFT_SIDEBAR_DEFAULTS)
  renderedPanels.push({ size: panel.size, visible: panel.visible })
  return null
}

function PanelPreferenceStoreProbe({
  onStoreReady,
  storeRef,
}: {
  onStoreReady?: (store: PanelPreferenceStoreApi) => void
  storeRef: { current: PanelPreferenceStoreApi | null }
}) {
  const store = usePanelPreferenceStoreApi()
  if (storeRef.current !== store) {
    storeRef.current = store
    onStoreReady?.(store)
  }
  return null
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}
