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
      showResourcePanel={false}
    />
  )
}

export function PublicDemoCanvasFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.connectedCanvas)

  return scenario.initialResourceId ? (
    <PublicDemoIsland
      ariaLabel="Canvas feature preview"
      showResourcePanel={false}
      scenario={scenario}
    />
  ) : null
}

export function PublicDemoMapFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.layeredLoreMap)

  return scenario.initialResourceId ? (
    <PublicDemoIsland
      ariaLabel="Map feature preview"
      scenario={scenario}
      showResourcePanel={false}
    />
  ) : null
}

export function PublicDemoSharingFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.collaborativeSessionNotes)

  return (
    <PublicDemoIsland
      ariaLabel="Collaborative note preview"
      canEdit
      scenario={scenario}
      showResourcePanel={false}
    />
  )
}

export function PublicDemoTemplateFeatureIsland() {
  const scenario = createPublicDemoScenario(PUBLIC_DEMO_SCENARIO_IDS.campaignTemplate)

  return (
    <PublicDemoIsland
      ariaLabel="Template note editor"
      canEdit
      showResourcePanel={false}
      scenario={scenario}
    />
  )
}

function PublicDemoIsland({
  ariaLabel,
  canEdit = true,
  scenario,
  showResourcePanel = true,
}: {
  ariaLabel: string
  canEdit?: boolean
  scenario: PublicDemoScenario
  showResourcePanel?: boolean
}) {
  return (
    <LocalWorkspaceRuntimeHost
      ariaLabel={ariaLabel}
      canEdit={canEdit}
      initialResourceId={scenario.initialResourceId}
      initialWorkspace={scenario.workspace}
      showResourcePanel={showResourcePanel}
      workspaceName="Demo workspace"
    />
  )
}
