import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { LocalWorkspaceFixture } from './local-workspace-fixture'
import {
  createSampleLocalWorkspaceFixture,
  SAMPLE_LOCAL_RESOURCE_IDS,
  SAMPLE_NOTE_BODY,
} from './sample-local-workspace'

export const PUBLIC_DEMO_SCENARIO_IDS = {
  campaignHome: 'campaign-home',
  campaignTemplate: 'campaign-template',
  collaborativeSessionNotes: 'collaborative-session-notes',
  connectedCanvas: 'connected-canvas',
  layeredLoreMap: 'layered-lore-map',
  playerPreview: 'player-preview',
  privatePrep: 'private-prep',
  revealReady: 'reveal-ready',
  revealedInPlay: 'revealed-in-play',
} as const

export type PublicDemoScenarioId =
  (typeof PUBLIC_DEMO_SCENARIO_IDS)[keyof typeof PUBLIC_DEMO_SCENARIO_IDS]

export interface PublicDemoScenario {
  id: PublicDemoScenarioId
  initialItemId: ResourceId | null
  workspace: LocalWorkspaceFixture
}

const PRIVATE_PREP_BODY = [
  SAMPLE_NOTE_BODY,
  '',
  'Routes: [[Moonwell Docks]] and [[Blue-glass Invoice]].',
  'Secret: Mara arranged the third signature.',
].join('\n')

const COLLABORATIVE_BODY = [
  'Scene: Moonwell Docks',
  '',
  '- Mara is watching the customs office.',
  '- Priya tagged the clues the players already know.',
  '- Jun adds: the tide tunnel opens after the third bell.',
].join('\n')

const TEMPLATE_BODY = [
  'Session Template',
  '',
  '## Opening scene',
  '## Important locations',
  '## Secrets and clues',
  '## Rewards',
].join('\n')

export function createPublicDemoScenario(id: PublicDemoScenarioId): PublicDemoScenario {
  switch (id) {
    case PUBLIC_DEMO_SCENARIO_IDS.campaignHome:
      return scenario(id, null)
    case PUBLIC_DEMO_SCENARIO_IDS.privatePrep:
    case PUBLIC_DEMO_SCENARIO_IDS.revealReady:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.marketNote, PRIVATE_PREP_BODY)
    case PUBLIC_DEMO_SCENARIO_IDS.playerPreview:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.marketNote, PRIVATE_PREP_BODY, 'player')
    case PUBLIC_DEMO_SCENARIO_IDS.revealedInPlay:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.marketNote, SAMPLE_NOTE_BODY, 'player')
    case PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.marketNote, COLLABORATIVE_BODY)
    case PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.heistCanvas)
    case PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.docksMap, SAMPLE_NOTE_BODY, 'player')
    case PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate:
      return scenario(id, SAMPLE_LOCAL_RESOURCE_IDS.marketNote, TEMPLATE_BODY)
    default:
      return unsupportedScenario(id)
  }
}

function scenario(
  id: PublicDemoScenarioId,
  initialItemId: ResourceId | null,
  noteBody = SAMPLE_NOTE_BODY,
  projection: 'dm' | 'player' = 'dm',
): PublicDemoScenario {
  return {
    id,
    initialItemId,
    workspace: createSampleLocalWorkspaceFixture({ noteBody, projection }),
  }
}

function unsupportedScenario(id: never): never {
  throw new Error(`Unsupported public demo scenario "${String(id)}"`)
}
