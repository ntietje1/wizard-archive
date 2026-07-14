import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createOpenSeparateDemoItem } from '../demo-navigation'
import { PUBLIC_DEMO_SCENARIO_IDS } from '../public-demo-workspace-presets'
import { SAMPLE_LOCAL_RESOURCE_IDS } from '../sample-local-workspace'

describe('openSeparateDemoItem', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState(null, '', '/')
  })

  it('opens a separate demo route for item and heading targets', () => {
    window.history.replaceState(null, '', '/demo')
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)
    const openSeparateItem = createOpenSeparateDemoItem({
      scenarioId: PUBLIC_DEMO_SCENARIO_IDS.campaignHome,
    })

    openSeparateItem({ itemId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote, heading: 'Intro#Details' })

    expect(openMock).toHaveBeenCalledWith(
      `${window.location.origin}/demo?scenario=campaign-home&item=${SAMPLE_LOCAL_RESOURCE_IDS.marketNote}&heading=Intro%23Details`,
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('opens scenario-specific demo routes without inheriting unrelated page state', () => {
    window.history.replaceState(null, '', '/?utm=landing#canvas')
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)
    const openSeparateItem = createOpenSeparateDemoItem({
      scenarioId: PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap,
    })

    openSeparateItem({ itemId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap })

    expect(openMock).toHaveBeenCalledWith(
      `${window.location.origin}/demo?scenario=layered-lore-map&item=${SAMPLE_LOCAL_RESOURCE_IDS.docksMap}`,
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('clears a stale heading when opening a separate item without a heading target', () => {
    window.history.replaceState(null, '', '/demo?scenario=lantern-market&heading=Old')
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)
    const openSeparateItem = createOpenSeparateDemoItem({
      scenarioId: PUBLIC_DEMO_SCENARIO_IDS.campaignHome,
    })

    openSeparateItem({ itemId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap })

    expect(openMock).toHaveBeenCalledWith(
      `${window.location.origin}/demo?scenario=campaign-home&item=${SAMPLE_LOCAL_RESOURCE_IDS.docksMap}`,
      '_blank',
      'noopener,noreferrer',
    )
  })
})
