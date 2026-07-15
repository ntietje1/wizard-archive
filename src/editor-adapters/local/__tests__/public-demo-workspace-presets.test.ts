import { describe, expect, it } from 'vite-plus/test'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '../public-demo-workspace-presets'
import { SAMPLE_LOCAL_RESOURCE_IDS } from '../sample-local-workspace'

describe('public demo workspace presets', () => {
  it('creates fresh canonical fixtures for every scenario', () => {
    const first = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)
    const second = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)

    expect(first.workspace).not.toBe(second.workspace)
    expect(first.workspace.content.notes?.[0]?.content).not.toBe(
      second.workspace.content.notes?.[0]?.content,
    )
    expect(first.workspace.snapshot.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
          kind: 'note',
          title: 'The Lantern Market',
        }),
        expect.objectContaining({
          id: SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas,
          kind: 'canvas',
          title: 'Harbor Heist Board',
        }),
        expect.objectContaining({
          id: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
          kind: 'map',
          title: 'Moonwell Docks',
        }),
      ]),
    )
  })

  it('selects each focused scenario by canonical resource ID', () => {
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome).initialResourceId,
    ).toBeNull()
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas).initialResourceId,
    ).toBe(SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas)
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap).initialResourceId,
    ).toBe(SAMPLE_LOCAL_RESOURCE_IDS.docksMap)
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)
        .initialResourceId,
    ).toBe(SAMPLE_LOCAL_RESOURCE_IDS.marketNote)
  })

  it('uses the projection scope as the only demo permission model', () => {
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep).workspace.scope.projection,
    ).toBe('dm')
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.playerPreview).workspace.scope.projection,
    ).toBe('player')
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap).workspace.scope.projection,
    ).toBe('player')
  })

  it('rejects unknown scenario IDs', () => {
    expect(() => createPublicDemoScenario('unknown-scenario' as never)).toThrow(
      'Unsupported public demo scenario "unknown-scenario"',
    )
  })
})
