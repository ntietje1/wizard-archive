import { LocalWorkspaceRuntimeHost } from '~/editor-adapters/local/local-workspace-runtime-host'
import {
  createPublicDemoScenario,
  PUBLIC_DEMO_SCENARIO_IDS,
} from '~/editor-adapters/local/public-demo-workspace-presets'
import type { PublicDemoScenario } from '~/editor-adapters/local/public-demo-workspace-presets'

export function PublicDemoHeroIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignHome)

  return <PublicDemoIsland ariaLabel="Demo workspace" canEdit={false} scenario={scenario} />
}

export function PublicDemoWorkspaceFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.privatePrep)

  return (
    <PublicDemoIsland
      ariaLabel="Text editor link autocomplete preview"
      canEdit
      scenario={scenario}
      resourcePanel="hidden"
    />
  )
}

export function PublicDemoCanvasFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas)

  return scenario.initialResourceId ? (
    <PublicDemoIsland
      ariaLabel="Canvas feature preview"
      resourcePanel="hidden"
      scenario={scenario}
    />
  ) : null
}

export function PublicDemoMapFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

  return scenario.initialResourceId ? (
    <PublicDemoIsland ariaLabel="Map feature preview" resourcePanel="hidden" scenario={scenario} />
  ) : null
}

export function PublicDemoSharingFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)

  return (
    <PublicDemoIsland
      ariaLabel="Collaborative note preview"
      canEdit
      scenario={scenario}
      resourcePanel="hidden"
    />
  )
}

export function PublicDemoTemplateFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate)

  return (
    <PublicDemoIsland
      ariaLabel="Template note editor"
      canEdit
      resourcePanel="hidden"
      scenario={scenario}
    />
  )
}

function PublicDemoIsland({
  ariaLabel,
  canEdit = true,
  scenario,
  resourcePanel = 'visible',
}: {
  ariaLabel: string
  canEdit?: boolean
  scenario: PublicDemoScenario
  resourcePanel?: 'visible' | 'hidden'
}) {
  return (
    <LocalWorkspaceRuntimeHost
      ariaLabel={ariaLabel}
      canEdit={canEdit}
      initialResourceId={scenario.initialResourceId}
      initialWorkspace={scenario.workspace}
      resourcePanel={resourcePanel}
      workspaceName="Demo workspace"
    />
  )
}
