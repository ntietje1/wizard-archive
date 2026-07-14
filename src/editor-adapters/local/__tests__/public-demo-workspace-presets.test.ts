import { describe, expect, it } from 'vite-plus/test'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '../public-demo-workspace-presets'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SAMPLE_LOCAL_RESOURCE_IDS } from '../sample-local-workspace'

const COLLABORATIVE_SESSION_SCENARIO = createPublicDemoScenario(
  PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes,
)
const PUBLIC_DEMO_SESSION_NOTE_ID = COLLABORATIVE_SESSION_SCENARIO.initialItemId!
const PUBLIC_DEMO_TUNNEL_SKETCH_FILE_ID = createPublicDemoScenario(
  PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap,
).workspace.items.find((item) => item.title === 'Tide Tunnel Sketch')!.id

describe('public demo workspace presets', () => {
  it('creates isolated mutable workspace instances for each scenario', () => {
    for (const scenarioId of Object.values(PUBLIC_DEMO_SCENARIO_IDS)) {
      const scenario = createPublicDemoScenario(scenarioId)
      const item = scenario.workspace.items.find(
        (candidate) => candidate.id === SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
      )
      if (!item) continue

      const originalTitle = item.title
      try {
        item.title = 'Mutated demo title'
        const nextScenario = createPublicDemoScenario(scenarioId)
        const nextItem = nextScenario.workspace.items.find(
          (candidate) => candidate.id === SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
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
      noteId: PUBLIC_DEMO_SESSION_NOTE_ID,
      typingText: expect.stringContaining('Jun adds:'),
    })
    const playback = scenario.collaborationPlayback!
    expect(scenario.initialItemId).toBe(PUBLIC_DEMO_SESSION_NOTE_ID)
    const seededTypingLine = scenario.workspace.noteBodiesById[PUBLIC_DEMO_SESSION_NOTE_ID]
      ?.split('\n')
      .at(-1)
    expect(
      seededTypingLine?.startsWith(playback.typingText.slice(0, playback.initialTypingStep)),
    ).toBe(true)
    expect(scenario.workspace.noteAdditionalBlocksById[PUBLIC_DEMO_SESSION_NOTE_ID]).toEqual([
      expect.objectContaining({
        type: 'embed',
        props: expect.objectContaining({
          targetKind: 'resource',
          resourceId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
        }),
      }),
    ])
  })

  it('grants the selected demo player access to the collaboration session note', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)
    const playerId = scenario.workspace.playerMembers?.[0]?.id
    if (!playerId) throw new Error('Expected the public demo player')

    expect(String(scenario.workspace.selectedViewAsPlayerId)).toBe(playerId)
    expect(
      scenario.workspace.memberItemPermissionsById?.[PUBLIC_DEMO_SESSION_NOTE_ID]?.[playerId],
    ).toBe(PERMISSION_LEVEL.VIEW)
  })

  it('keeps private prep note links complete', () => {
    const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)

    expect(scenario.workspace.noteBodiesById[SAMPLE_LOCAL_RESOURCE_IDS.marketNote]).toContain(
      '[[Moonwell Docks]]',
    )
    expect(scenario.workspace.noteBodiesById[SAMPLE_LOCAL_RESOURCE_IDS.marketNote]).not.toContain(
      '[[moon',
    )
  })

  it('resolves named demo scenarios from the canonical local fixture', () => {
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)).toMatchObject({
      id: 'campaign-home',
      initialItemId: null,
      workspace: expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
            title: 'The Lantern Market',
          }),
          expect.objectContaining({
            id: SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas,
            title: 'Harbor Heist Board',
          }),
          expect.objectContaining({
            id: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
            title: 'Moonwell Docks',
          }),
        ]),
      }),
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas)).toMatchObject({
      id: 'connected-canvas',
      initialItemId: SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas,
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)).toMatchObject({
      id: 'layered-lore-map',
      initialItemId: SAMPLE_LOCAL_RESOURCE_IDS.docksMap,
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealReady)).toMatchObject({
      id: 'reveal-ready',
      initialItemId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
    })
    expect(createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.revealedInPlay)).toMatchObject({
      id: 'revealed-in-play',
      initialItemId: SAMPLE_LOCAL_RESOURCE_IDS.marketNote,
    })
    expect(
      createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes),
    ).toMatchObject({
      id: 'collaborative-session-notes',
      initialItemId: PUBLIC_DEMO_SESSION_NOTE_ID,
      collaborationPlayback: expect.objectContaining({
        noteId: PUBLIC_DEMO_SESSION_NOTE_ID,
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
    const playerId = scenario.workspace.playerMembers?.[0]?.id
    if (!playerId) throw new Error('Expected the public demo player')

    expect(String(scenario.workspace.selectedViewAsPlayerId)).toBe(playerId)
    expect(
      scenario.workspace.memberItemPermissionsById?.[SAMPLE_LOCAL_RESOURCE_IDS.docksMap]?.[
        playerId
      ],
    ).toBe(PERMISSION_LEVEL.VIEW)
    expect(
      scenario.workspace.memberItemPermissionsById?.[SAMPLE_LOCAL_RESOURCE_IDS.marketNote]?.[
        playerId
      ],
    ).toBe(PERMISSION_LEVEL.NONE)
    expect(
      scenario.workspace.memberItemPermissionsById?.[SAMPLE_LOCAL_RESOURCE_IDS.invoiceFile]?.[
        playerId
      ],
    ).toBe(PERMISSION_LEVEL.VIEW)
    expect(
      scenario.workspace.memberItemPermissionsById?.[PUBLIC_DEMO_TUNNEL_SKETCH_FILE_ID]?.[playerId],
    ).toBe(PERMISSION_LEVEL.VIEW)
    expect(scenario.workspace.mapsById[SAMPLE_LOCAL_RESOURCE_IDS.docksMap]?.layers).toEqual([
      expect.objectContaining({
        id: 'map-docks-layer-1',
        name: 'Layer 1',
      }),
      expect.objectContaining({
        id: 'map-docks-layer-2',
        name: 'Layer 2',
      }),
    ])
    expect(scenario.workspace.mapsById[SAMPLE_LOCAL_RESOURCE_IDS.docksMap]?.pins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas,
          layerId: 'map-docks-layer-2',
          visible: false,
        }),
        expect.objectContaining({
          itemId: PUBLIC_DEMO_TUNNEL_SKETCH_FILE_ID,
          layerId: 'map-docks-layer-2',
          visible: true,
        }),
      ]),
    )
  })
})
