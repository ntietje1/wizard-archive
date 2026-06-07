import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePanelPreference } from '../use-panel-preference'
import { usePanelPreferenceStore } from '~/features/settings/stores/panel-preference-store'

const { mutateMock } = vi.hoisted(() => ({
  mutateMock: vi.fn(),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({ mutate: mutateMock }),
}))

describe('usePanelPreference', () => {
  beforeEach(() => {
    mutateMock.mockClear()
    usePanelPreferenceStore.setState({ panels: {}, isLoaded: false })
  })

  it('does not initialize shared panel state while rendering', () => {
    render(<PanelPreferenceProbe />)

    expect(usePanelPreferenceStore.getState().panels).toEqual({})
  })
})

function PanelPreferenceProbe() {
  usePanelPreference('test-panel', { size: 20, visible: true })
  return null
}
