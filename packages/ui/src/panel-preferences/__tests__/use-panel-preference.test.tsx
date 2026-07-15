import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { usePanelPreference } from '../use-panel-preference'
import { usePanelPreferenceStore } from '@wizard-archive/ui/panel-preferences/store'

describe('usePanelPreference', () => {
  beforeEach(() => {
    usePanelPreferenceStore.setState({ panels: {}, isLoaded: false })
  })

  it('does not initialize shared panel state while rendering', () => {
    render(<PanelPreferenceProbe />)

    expect(usePanelPreferenceStore.getState().panels).toEqual({})
  })

  it('applies partial persisted preferences independently', () => {
    usePanelPreferenceStore
      .getState()
      .applyPanelPreference(
        'test-panel',
        { size: null, visible: false },
        { size: 20, visible: true },
      )

    expect(usePanelPreferenceStore.getState().panels['test-panel']).toEqual({
      size: 20,
      visible: false,
    })
  })
})

function PanelPreferenceProbe() {
  usePanelPreference('test-panel', { size: 20, visible: true })
  return null
}
