import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignPanelPreferencesController } from '../campaign-panel-preferences-controller'
import { RIGHT_SIDEBAR_PANEL_ID } from '~/features/editor/components/right-sidebar/constants'
import {
  LEFT_SIDEBAR_DEFAULTS,
  LEFT_SIDEBAR_PANEL_ID,
} from '~/features/sidebar/components/sidebar-toolbar/constants'
import { usePanelPreference } from '~/features/settings/hooks/use-panel-preference'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'
import type { UserPreferences } from 'shared/user-preferences/types'

const { mutateMock, preferencesQueryState } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
  preferencesQueryState: {
    data: null as UserPreferences | null,
    isSuccess: false,
  },
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => preferencesQueryState,
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({ mutate: mutateMock }),
}))

describe('CampaignPanelPreferencesController', () => {
  beforeEach(() => {
    mutateMock.mockClear()
    preferencesQueryState.data = null
    preferencesQueryState.isSuccess = false
    usePanelPreferenceStore.setState({ panels: {}, isLoaded: false })
  })

  it('initializes known campaign panels from route-prefetched preferences', async () => {
    render(
      <CampaignPanelPreferencesController
        initialPanelPreferences={{
          [LEFT_SIDEBAR_PANEL_ID]: { size: 31, visible: false },
          [RIGHT_SIDEBAR_PANEL_ID]: { size: 28, visible: true },
        }}
      >
        <div />
      </CampaignPanelPreferencesController>,
    )

    await waitFor(() => {
      expect(usePanelPreferenceStore.getState().panels[LEFT_SIDEBAR_PANEL_ID]).toMatchObject({
        size: 31,
        visible: false,
        activeContentId: null,
      })
      expect(usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]).toMatchObject({
        size: 28,
        visible: true,
        activeContentId: null,
      })
    })
  })

  it('exposes route-prefetched panel preferences on the first render', () => {
    const renderedPanels: Array<{ size: number; visible: boolean }> = []

    render(
      <CampaignPanelPreferencesController
        initialPanelPreferences={{
          [LEFT_SIDEBAR_PANEL_ID]: { size: 31, visible: false },
        }}
      >
        <PanelPreferenceProbe renderedPanels={renderedPanels} />
      </CampaignPanelPreferencesController>,
    )

    expect(renderedPanels[0]).toEqual({ size: 31, visible: false })
  })

  it('reconciles server panel preferences without clearing active content', async () => {
    usePanelPreferenceStore.setState({
      isLoaded: false,
      panels: {
        [RIGHT_SIDEBAR_PANEL_ID]: {
          size: 20,
          visible: true,
          activeContentId: 'history',
        },
      },
    })
    preferencesQueryState.data = {
      theme: null,
      panelPreferences: {
        [RIGHT_SIDEBAR_PANEL_ID]: { size: 38, visible: false },
      },
    }
    preferencesQueryState.isSuccess = true

    render(
      <CampaignPanelPreferencesController initialPanelPreferences={null}>
        <div />
      </CampaignPanelPreferencesController>,
    )

    await waitFor(() => {
      expect(usePanelPreferenceStore.getState().isLoaded).toBe(true)
      expect(usePanelPreferenceStore.getState().panels[RIGHT_SIDEBAR_PANEL_ID]).toMatchObject({
        size: 38,
        visible: false,
        activeContentId: 'history',
      })
    })
  })

  it('does not overwrite local panel changes after the first server reconciliation', async () => {
    preferencesQueryState.data = {
      theme: null,
      panelPreferences: {
        [LEFT_SIDEBAR_PANEL_ID]: { size: 22, visible: false },
      },
    }
    preferencesQueryState.isSuccess = true

    const { rerender } = render(
      <CampaignPanelPreferencesController initialPanelPreferences={null}>
        <div />
      </CampaignPanelPreferencesController>,
    )

    await waitFor(() => {
      expect(usePanelPreferenceStore.getState().panels[LEFT_SIDEBAR_PANEL_ID]).toMatchObject({
        size: 22,
        visible: false,
      })
    })

    usePanelPreferenceStore.getState().setVisible(LEFT_SIDEBAR_PANEL_ID, true)
    preferencesQueryState.data = {
      theme: null,
      panelPreferences: {
        [LEFT_SIDEBAR_PANEL_ID]: { size: 22, visible: false },
      },
    }

    rerender(
      <CampaignPanelPreferencesController initialPanelPreferences={null}>
        <div />
      </CampaignPanelPreferencesController>,
    )

    expect(usePanelPreferenceStore.getState().panels[LEFT_SIDEBAR_PANEL_ID]).toMatchObject({
      size: 22,
      visible: true,
    })
  })
})

function PanelPreferenceProbe({
  renderedPanels,
}: {
  renderedPanels: Array<{ size: number; visible: boolean }>
}) {
  const panel = usePanelPreference(LEFT_SIDEBAR_PANEL_ID, LEFT_SIDEBAR_DEFAULTS)
  renderedPanels.push({ size: panel.size, visible: panel.visible })
  return null
}
