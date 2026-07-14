import { describe, expect, it } from 'vite-plus/test'
import { parsePublicDemoRouteSearchParams } from '../demo-navigation'
import { PUBLIC_DEMO_SCENARIO_IDS } from '../public-demo-workspace-presets'

describe('parsePublicDemoRouteSearchParams', () => {
  it('accepts a known scenario', () => {
    expect(
      parsePublicDemoRouteSearchParams(new URLSearchParams('scenario=layered-lore-map')),
    ).toEqual({ scenarioId: PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap })
  })

  it('defaults unknown scenarios to the campaign home', () => {
    expect(parsePublicDemoRouteSearchParams(new URLSearchParams('scenario=unknown'))).toEqual({
      scenarioId: PUBLIC_DEMO_SCENARIO_IDS.campaignHome,
    })
  })
})
