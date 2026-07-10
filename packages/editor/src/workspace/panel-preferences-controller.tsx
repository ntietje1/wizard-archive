import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { PanelPreferenceInitialProvider } from '@wizard-archive/ui/panel-preferences/initial-provider'
import {
  PanelPreferenceStoreProvider,
  usePanelPreferenceStoreApi,
} from '@wizard-archive/ui/panel-preferences/store'
import { useStore } from 'zustand'
import { EDITOR_WORKSPACE_PANEL_DEFINITIONS } from './panel-definitions'
import type { WorkspaceRuntimeHostPanelPreferencesSource } from './runtime-host'

export function WorkspacePanelPreferencesController({
  children,
  source,
}: {
  children: ReactNode
  source: WorkspaceRuntimeHostPanelPreferencesSource
}) {
  return (
    <PanelPreferenceStoreProvider>
      <ScopedWorkspacePanelPreferencesController source={source}>
        {children}
      </ScopedWorkspacePanelPreferencesController>
    </PanelPreferenceStoreProvider>
  )
}

function ScopedWorkspacePanelPreferencesController({
  children,
  source,
}: {
  children: ReactNode
  source: WorkspaceRuntimeHostPanelPreferencesSource
}) {
  const store = usePanelPreferenceStoreApi()
  const applyPanelPreference = useStore(store, (state) => state.applyPanelPreference)
  const setLoaded = useStore(store, (state) => state.setLoaded)
  const isApplyingPreferencesRef = useRef(false)
  const onPanelPreferenceChangeRef = useRef(source.onPanelPreferenceChange)
  const appliedLoadedPreferencesKeyRef = useRef<string | null>(null)
  const saveRevisionByPanelIdRef = useRef(new Map<string, number>())

  useEffect(() => {
    onPanelPreferenceChangeRef.current = source.onPanelPreferenceChange
  }, [source.onPanelPreferenceChange])

  useEffect(() => {
    const unsubscribe = store.subscribe((state, previousState) => {
      if (isApplyingPreferencesRef.current) return

      for (const { panelId } of EDITOR_WORKSPACE_PANEL_DEFINITIONS) {
        const panel = state.panels[panelId]
        const previousPanel = previousState.panels[panelId]
        if (!panel) continue
        if (previousPanel?.size === panel.size && previousPanel?.visible === panel.visible) {
          continue
        }

        const persistPreference = onPanelPreferenceChangeRef.current
        if (!persistPreference) continue
        const revision = (saveRevisionByPanelIdRef.current.get(panelId) ?? 0) + 1
        saveRevisionByPanelIdRef.current.set(panelId, revision)
        void (async () => {
          try {
            await persistPreference({
              panelId,
              size: panel.size,
              visible: panel.visible,
            })
          } catch {
            if (saveRevisionByPanelIdRef.current.get(panelId) !== revision) return
            const definition = EDITOR_WORKSPACE_PANEL_DEFINITIONS.find(
              (candidate) => candidate.panelId === panelId,
            )
            if (!definition) return
            isApplyingPreferencesRef.current = true
            applyPanelPreference(panelId, previousPanel ?? definition.defaults, definition.defaults)
            isApplyingPreferencesRef.current = false
          }
        })()
      }
    })
    return unsubscribe
  }, [applyPanelPreference, store])

  useEffect(() => {
    appliedLoadedPreferencesKeyRef.current = null
    setLoaded(false)
    isApplyingPreferencesRef.current = true
    for (const { defaults, panelId } of EDITOR_WORKSPACE_PANEL_DEFINITIONS) {
      const initial = source.initialPanelPreferences?.[panelId]
      applyPanelPreference(
        panelId,
        {
          size: initial?.size ?? defaults.size,
          visible: initial?.visible ?? defaults.visible,
        },
        defaults,
      )
    }
    isApplyingPreferencesRef.current = false
  }, [applyPanelPreference, source.initialPanelPreferences, setLoaded])

  useEffect(() => {
    if (!source.isLoaded) return
    const appliedPreferencesKey = getPanelPreferencesSnapshotKey(source.appliedPanelPreferences)
    if (appliedLoadedPreferencesKeyRef.current === appliedPreferencesKey) return
    appliedLoadedPreferencesKeyRef.current = appliedPreferencesKey

    isApplyingPreferencesRef.current = true
    for (const { defaults, panelId } of EDITOR_WORKSPACE_PANEL_DEFINITIONS) {
      const appliedPanel = source.appliedPanelPreferences?.[panelId]
      applyPanelPreference(
        panelId,
        {
          size: appliedPanel?.size ?? defaults.size,
          visible: appliedPanel?.visible ?? defaults.visible,
        },
        defaults,
      )
    }
    isApplyingPreferencesRef.current = false
    setLoaded(true)
  }, [
    applyPanelPreference,
    source.appliedPanelPreferences,
    source.initialPanelPreferences,
    source.isLoaded,
    setLoaded,
  ])

  return (
    <PanelPreferenceInitialProvider initialPanelPreferences={source.initialPanelPreferences}>
      {children}
    </PanelPreferenceInitialProvider>
  )
}

function getPanelPreferencesSnapshotKey(
  preferences: WorkspaceRuntimeHostPanelPreferencesSource['appliedPanelPreferences'],
) {
  return EDITOR_WORKSPACE_PANEL_DEFINITIONS.map(({ defaults, panelId }) => {
    const panel = preferences?.[panelId]
    return `${panelId}:${panel?.size ?? defaults.size}:${panel?.visible ?? defaults.visible}`
  }).join('|')
}
