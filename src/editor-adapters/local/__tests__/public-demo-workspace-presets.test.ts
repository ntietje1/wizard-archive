import { describe, expect, it } from 'vite-plus/test'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '../public-demo-workspace-presets'
import { PERMISSION_LEVEL } from 'shared/permissions/types'

describe('public demo workspace presets', () => {
  it('creates isolated mutable workspace instances for each scenario', () => {
    for (const scenarioId of Object.values(PUBLIC_DEMO_SCENARIO_IDS)) {
      const scenario = createPublicDemoScenario(scenarioId)
      const item = scenario.workspace.items.find((candidate) => candidate.id === 'note-market')
      if (!item) continue

      const originalTitle = item.title
      try {
        item.title = 'Mutated demo title'
        const nextScenario = createPublicDemoScenario(scenarioId)
        const nextItem = nextScenario.workspace.items.find(
          (candidate) => candidate.id === 'note-market',
        )

        expect(nextItem?.title).toBe(originalTitle)
      } finally {
        item.title = originalTitle
      }
    }
  })

  it('anchors note-body scenarios to an existing local note item', () => {
    const workspaces = [
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep).workspace,
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealReady).workspace,
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealedInPlay).workspace,
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes).workspace,
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate).workspace,
    ]

    for (const workspace of workspaces) {
      const noteIds = workspace.items.filter((item) => item.type === 'note').map((item) => item.id)
      const bodyIds = Object.keys(workspace.noteBodiesById)

      expect(bodyIds.sort()).toEqual(noteIds.sort())
    }
  })

  it('keeps the collaboration playback note in the collaboration preset', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)

    expect(scenario.collaborationPlayback).toMatchObject({
      noteId: 'note-session',
      typingText: expect.stringContaining('Jun adds:'),
    })
    const playback = scenario.collaborationPlayback!
    expect(scenario.initialItemId).toBe('note-session')
    const seededTypingLine = scenario.workspace.noteBodiesById['note-session']?.split('\n').at(-1)
    expect(
      seededTypingLine?.startsWith(playback.typingText.slice(0, playback.initialTypingStep)),
    ).toBe(true)
    expect(scenario.workspace.noteAdditionalBlocksById['note-session']).toEqual([
      expect.objectContaining({
        type: 'embed',
        props: expect.objectContaining({
          targetKind: 'resource',
          resourceId: 'note-market',
        }),
      }),
    ])
  })

  it('grants the selected demo player access to the collaboration session note', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)

    expect(scenario.workspace.selectedViewAsPlayerId).toBe('demo-member-mira')
    expect(
      scenario.workspace.memberItemPermissionsById?.['note-session']?.['demo-member-mira'],
    ).toBe(PERMISSION_LEVEL.VIEW)
  })

  it('keeps private prep note links complete', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)

    expect(scenario.workspace.noteBodiesById['note-market']).toContain('[[Moonwell Docks]]')
    expect(scenario.workspace.noteBodiesById['note-market']).not.toContain('[[moon')
  })

  it('resolves named demo scenarios from the canonical local fixture', () => {
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)).toMatchObject({
      id: 'campaign-home',
      initialItemId: null,
      workspace: expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ id: 'note-market', title: 'The Lantern Market' }),
          expect.objectContaining({ id: 'canvas-heist', title: 'Harbor Heist Board' }),
          expect.objectContaining({ id: 'map-docks', title: 'Moonwell Docks' }),
        ]),
      }),
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas)).toMatchObject({
      id: 'connected-canvas',
      initialItemId: 'canvas-heist',
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)).toMatchObject({
      id: 'layered-lore-map',
      initialItemId: 'map-docks',
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealReady)).toMatchObject({
      id: 'reveal-ready',
      initialItemId: 'note-market',
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealedInPlay)).toMatchObject({
      id: 'revealed-in-play',
      initialItemId: 'note-market',
    })
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes),
    ).toMatchObject({
      id: 'collaborative-session-notes',
      initialItemId: 'note-session',
      collaborationPlayback: expect.objectContaining({
        noteId: 'note-session',
        typingText: expect.stringContaining('Jun adds:'),
      }),
    })
  })

  it('rejects unknown public demo scenario ids instead of loading the template preset', () => {
    expect(() => createPublicDemoScenario('unknown-scenario' as never)).toThrow(
      'Unsupported public demo scenario "unknown-scenario"',
    )
  })

  it('models layered map pin visibility through player item permissions', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

    expect(scenario.workspace.selectedViewAsPlayerId).toBe('demo-member-mira')
    expect(scenario.workspace.memberItemPermissionsById?.['map-docks']?.['demo-member-mira']).toBe(
      PERMISSION_LEVEL.VIEW,
    )
    expect(
      scenario.workspace.memberItemPermissionsById?.['note-market']?.['demo-member-mira'],
    ).toBe(PERMISSION_LEVEL.NONE)
    expect(
      scenario.workspace.memberItemPermissionsById?.['file-handout']?.['demo-member-mira'],
    ).toBe(PERMISSION_LEVEL.VIEW)
    expect(
      scenario.workspace.memberItemPermissionsById?.['file-tunnel-sketch']?.['demo-member-mira'],
    ).toBe(PERMISSION_LEVEL.VIEW)
    expect(scenario.workspace.mapsById['map-docks']?.layers).toEqual([
      expect.objectContaining({
        id: 'map-docks-layer-1',
        name: 'Layer 1',
      }),
      expect.objectContaining({
        id: 'map-docks-layer-2',
        name: 'Layer 2',
      }),
    ])
    expect(scenario.workspace.mapsById['map-docks']?.pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'canvas-heist',
          layerId: 'map-docks-layer-2',
          visible: false,
        }),
        expect.objectContaining({
          itemId: 'file-tunnel-sketch',
          layerId: 'map-docks-layer-2',
          visible: true,
        }),
      ]),
    )
  })
})
